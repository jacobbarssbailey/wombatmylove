import os
import shutil

# Define the file and directory paths
image_list_path = 'image_list.txt'
old_dir = 'img_old'
new_dir = 'img'

# Read the list of files from image_list.txt
with open(image_list_path, 'r') as file:
    listed_files = set(file.read().splitlines())

# Ensure the new directory exists
if not os.path.exists(new_dir):
    os.makedirs(new_dir)

# Check each file in the old directory
for filename in os.listdir(old_dir):
    old_file_path = os.path.join(old_dir, filename)
    if os.path.isfile(old_file_path):
        if filename not in listed_files:
            # Move the file to the new directory
            shutil.move(old_file_path, os.path.join(new_dir, filename))

print("Files have been moved as needed.")