import Script from "next/script"
import { getPublicAnalyticsConfig } from "@/lib/integrations/get-public-analytics-config"

/** Async server component — reads only enabled+connected analytics providers'
 * public IDs (never secrets) and injects the standard GA4/Meta Pixel
 * snippets. The one place the Plug-and-Play Integration System's effect
 * reaches outside /admin, since that's what analytics tags are for. */
export async function AnalyticsScripts() {
  const config = await getPublicAnalyticsConfig()

  return (
    <>
      {config.googleAnalytics && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${config.googleAnalytics.measurementId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${config.googleAnalytics.measurementId}');`}
          </Script>
        </>
      )}
      {config.metaPixel && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${config.metaPixel.pixelId}');
            fbq('track', 'PageView');`}
        </Script>
      )}
    </>
  )
}
