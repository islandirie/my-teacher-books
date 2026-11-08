// Public Google OAuth client id (safe to ship; never put a client secret here).
// Set VITE_GOOGLE_CLIENT_ID in .env to use your own Google Cloud project.
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '690997915640-8tha4kv0edetc5nh0krogvus2sasf2hu.apps.googleusercontent.com';
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
