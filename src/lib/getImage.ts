import * as fs from 'fs';
import * as path from 'path';

const IMAGE_DIRECTORY_PATH = './img'; // Change to your directory path
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg']; // Add more if needed

function getImage(): string | null {
  const imageFiles = fs.readdirSync(IMAGE_DIRECTORY_PATH)
    .filter(file => IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase()));

  if (imageFiles.length === 0) {
    return null; // No image files found
  }

  const randomIndex = Math.floor(Math.random() * imageFiles.length);
  const randomImage = imageFiles[randomIndex];

  // Check if the random image is already in the list file
  const listFilePath = path.join(IMAGE_DIRECTORY_PATH, 'image_list.txt');
  if (fs.existsSync(listFilePath)) {
    const listContent = fs.readFileSync(listFilePath, 'utf-8');
    if (listContent.includes(randomImage)) {
      return getImage(); // Recursively get another image if already listed
    }
  } else {
    // Create the list file if it doesn't exist
    fs.writeFileSync(listFilePath, '');
  }

  // Append the filename to the list file
  fs.appendFileSync(listFilePath, randomImage + '\n');

  return path.join(IMAGE_DIRECTORY_PATH, randomImage);
}

export { getImage };