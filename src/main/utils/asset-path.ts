import path from 'path';
import { app } from 'electron';
import { existsSync } from 'fs';

/**
 * Get the correct path to an asset file in both development and production builds.
 * Handles both asar-packed and unpacked scenarios.
 * 
 * @param assetPath - Relative path from the assets directory (e.g., 'logo.png')
 * @returns Absolute path to the asset file
 */
export function getAssetPath(assetPath: string): string {
  // In development, __dirname points to dist/main/main/utils
  // In production, it points to the packaged app location
  
  if (process.env.NODE_ENV === 'development') {
    // Development: assets are at project root
    // From dist/main/main/utils, go up 4 levels to reach project root
    const devPath = path.join(__dirname, '../../../../assets', assetPath);
    
    // Verify the path exists, if not try alternative paths
    if (!existsSync(devPath)) {
      // Try going up 3 levels (in case structure is different)
      const altPath = path.join(__dirname, '../../../assets', assetPath);
      if (existsSync(altPath)) {
        console.log(`[AssetPath] Development path (alt): ${altPath}`);
        return altPath;
      }
      
      // Try using process.cwd() as fallback
      const cwdPath = path.join(process.cwd(), 'assets', assetPath);
      if (existsSync(cwdPath)) {
        console.log(`[AssetPath] Development path (cwd): ${cwdPath}`);
        return cwdPath;
      }
      
      console.warn(`[AssetPath] Asset not found in development. Tried:`, {
        main: devPath,
        alt: altPath,
        cwd: cwdPath,
      });
    } else {
      console.log(`[AssetPath] Development path: ${devPath}`);
    }
    
    return devPath;
  }
  
  // Production: electron-builder copies assets to resources/assets (outside app.asar)
  // Try resources/assets first (packaged app)
  if (process.resourcesPath) {
    const resourcesPath = path.join(process.resourcesPath, 'assets', assetPath);
    if (existsSync(resourcesPath)) {
      console.log(`[AssetPath] Found in resources: ${resourcesPath}`);
      return resourcesPath;
    }
  }
  
  // Fallback: check app directory (for unpacked builds or if resourcesPath doesn't work)
  const appPath = app.getAppPath();
  
  // Check if we're in an asar archive
  if (appPath.includes('.asar')) {
    // Assets are outside app.asar in resources folder
    // app.getAppPath() returns path to app.asar, so go up to resources
    const resourcesPath = path.join(path.dirname(appPath), 'assets', assetPath);
    if (existsSync(resourcesPath)) {
      console.log(`[AssetPath] Found in resources (from app.asar): ${resourcesPath}`);
      return resourcesPath;
    }
  }
  
  // Last fallback: check inside app directory
  const appAssetsPath = path.join(appPath, 'assets', assetPath);
  if (existsSync(appAssetsPath)) {
    console.log(`[AssetPath] Found in app directory: ${appAssetsPath}`);
    return appAssetsPath;
  }
  
  // Log warning if not found
  console.warn(`[AssetPath] Asset not found: ${assetPath}. Tried:`, {
    resourcesPath: process.resourcesPath ? path.join(process.resourcesPath, 'assets', assetPath) : 'N/A',
    appPath: appAssetsPath,
  });
  
  // Return the resources path as default (electron-builder standard location)
  return process.resourcesPath 
    ? path.join(process.resourcesPath, 'assets', assetPath)
    : appAssetsPath;
}

/**
 * Get the path to the logo icon file.
 * Returns the appropriate format based on platform:
 * - Windows: .ico
 * - macOS/Linux: .png
 */
export function getLogoIconPath(): string {
  const iconFile = process.platform === 'win32' ? 'logo.ico' : 'logo.png';
  const iconPath = getAssetPath(iconFile);
  console.log(`[Icon] Platform: ${process.platform}, Icon file: ${iconFile}, Path: ${iconPath}`);
  return iconPath;
}
