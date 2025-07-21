import os from 'os';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

export const execAsync = promisify(exec);

// Helper function to create a temporary directory for test downloads
export function createTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-pdf-test-'));
  return tempDir;
}

// Helper function to clean up temporary directory
export function cleanupTempDir(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Helper function to get the appropriate ImageMagick command based on the environment
export async function getImageMagickCommand() {
  try {
    // Try 'magick' command first (ImageMagick 7+)
    await execAsync('magick -version');
    return {
      convert: 'magick',
      identify: 'magick identify'
    };
  } catch (error) {
    // Fall back to 'convert' and 'identify' (ImageMagick 6)
    return {
      convert: 'convert',
      identify: 'identify'
    };
  }
}