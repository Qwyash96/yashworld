import "server-only"
import { getDecryptedCredentials, getIntegrationConfig } from "@/lib/integrations/config-store"

/** Only ever the public IDs — never apiSecret/accessToken — safe to render into a client script tag. */
export interface PublicAnalyticsConfig {
  googleAnalytics: { measurementId: string } | null
  metaPixel: { pixelId: string } | null
}

export async function getPublicAnalyticsConfig(): Promise<PublicAnalyticsConfig> {
  const [gaConfig, gaCredentials, pixelConfig, pixelCredentials] = await Promise.all([
    getIntegrationConfig("google_analytics"),
    getDecryptedCredentials("google_analytics"),
    getIntegrationConfig("meta_pixel"),
    getDecryptedCredentials("meta_pixel"),
  ])

  return {
    googleAnalytics:
      gaConfig.enabled && gaConfig.connected && gaCredentials.measurementId
        ? { measurementId: gaCredentials.measurementId }
        : null,
    metaPixel:
      pixelConfig.enabled && pixelConfig.connected && pixelCredentials.pixelId
        ? { pixelId: pixelCredentials.pixelId }
        : null,
  }
}
