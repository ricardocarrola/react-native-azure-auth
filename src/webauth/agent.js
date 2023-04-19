import {
    NativeModules,
    Linking
} from 'react-native'

export default class Agent {

    openWeb(url, closeOnLoad = false) {
        if (!NativeModules.AzureAuth) {
            return Promise.reject(new Error('Missing NativeModule. Please make sure you run `react-native link react-native-azure-auth`'))
        }

        return new Promise((resolve, reject) => {
            let eventURL
            const removeListener = () => {
                //This is done to handle backward compatibility with RN <= 0.64 which doesn't return EmitterSubscription on addEventListener
                if (eventURL === undefined) {
                    Linking.removeEventListener('url', urlHandler)
                } else {
                    eventURL.remove()
                }
            }
            const urlHandler = (event) => {
                NativeModules.AzureAuth.hide()
                removeListener();
                resolve(event.url)
            }
            eventURL = Linking.addEventListener('url', urlHandler)
            NativeModules.AzureAuth.showUrl(url, closeOnLoad, (err, redirectURL) => {
                removeListener();
                if (err) {
                    reject(err)
                } else if (redirectURL) {
                    resolve(redirectURL)
                } else if (closeOnLoad) {
                    resolve()
                }
            })
        })
    }

    generateRequestParams() {
        if (!NativeModules.AzureAuth) {
            return Promise.reject(new Error('Missing NativeModule. Please make sure you run `react-native link react-native-azure-auth`'))
        }
        /* eslint no-unused-vars:0 */
        return new Promise((resolve, reject) => {
            NativeModules.AzureAuth.oauthParameters((parameters) => {
                resolve(parameters)
            })
        })
    }
}