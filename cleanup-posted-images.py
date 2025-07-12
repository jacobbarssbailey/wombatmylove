import os
import shutil

IMG_DIR = 'img'
POSTED_DIR = 'img_posted'
IMAGE_LIST_FILE = os.path.join(IMG_DIR, 'image_list.txt')
POSTED_LOG_FILE = os.path.join(POSTED_DIR, 'posted_images.txt')

def main():
    # Read list of image filenames from image_list.txt
    with open(IMAGE_LIST_FILE, 'r') as f:
        image_list = [line.strip() for line in f if line.strip()]

    moved_files = []

    for filename in image_list:
        src_path = os.path.join(IMG_DIR, filename)
        dst_path = os.path.join(POSTED_DIR, filename)
        if os.path.exists(src_path):
            shutil.move(src_path, dst_path)
            moved_files.append(filename)

    # Append moved filenames to posted_images.txt
    if moved_files:
        with open(POSTED_LOG_FILE, 'a') as f:
            for filename in moved_files:
                f.write(filename + '\n')

if __name__ == '__main__':
    main()