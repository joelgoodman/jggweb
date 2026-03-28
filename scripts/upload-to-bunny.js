import uploadToBunny from 'upload-to-bunny';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function uploadBuild() {
  const requiredEnv = ['BUNNY_API_KEY', 'BUNNY_STORAGE_ZONE'];
  const missingEnv = requiredEnv.filter(key => !process.env[key]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  }

  const buildDir = path.join(process.cwd(), '_site');

  if (!await fs.access(buildDir).then(() => true).catch(() => false)) {
    throw new Error('Build directory not found! Please run the build first.');
  }

  console.log('Starting upload to Bunny.net:');
  console.log(`Storage Zone: ${process.env.BUNNY_STORAGE_ZONE}`);

  try {
    await uploadToBunny(
      buildDir,
      '',
      {
        storageZoneName: process.env.BUNNY_STORAGE_ZONE,
        accessKey: process.env.BUNNY_API_KEY,
        cleanDestination: process.env.CLEAN_DESTINATION === 'true',
        maxConcurrentUploads: 10
      }
    );

    console.log('Upload completed!');
    console.log('Files should be available at:');
    console.log(`https://cdn.bunny.net/${process.env.BUNNY_STORAGE_ZONE}/`);
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

uploadBuild().catch(console.error);
