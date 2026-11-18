package expo.modules.sitecookies

import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SiteCookiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SiteCookies")

    // Ends the login sessions but keeps cookies with an expiry date, such as the
    // "don't ask for the code for a while" one.
    AsyncFunction("clearSessionCookies") { promise: Promise ->
      Handler(Looper.getMainLooper()).post {
        val cookies = CookieManager.getInstance()
        cookies.removeSessionCookies {
          cookies.flush()
          promise.resolve(true)
        }
      }
    }
  }
}
