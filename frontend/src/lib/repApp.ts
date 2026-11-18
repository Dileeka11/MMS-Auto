/* NMS Sales Rep — Android app download (Flutter app in /mobile).
   The APK lives at public/downloads/nms-sales-rep.apk; its size is read at
   build time (see `__REP_APK_SIZE__` in vite.config.ts). */
export const REP_APP_VERSION = '2.0.0'
export const REP_APK_URL = '/downloads/nms-sales-rep.apk'
export const REP_APK_SIZE: string = __REP_APK_SIZE__
export const REP_WEB_URL = '/rep-app/'
