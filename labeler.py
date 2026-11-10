import anthropic
import os, sys
import base64
import re
import subprocess
import unicodedata
from dotenv import load_dotenv

## Read ANTHROPIC_API_KEY from .env; an already-exported value wins.
load_dotenv()

MEDIA_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}
VIDEO_EXTENSIONS = {".mp4"}
# Folders whose filenames must stay unique: a label that matches an existing
# file would overwrite it (staging/img) or be treated as already posted.
UNIQUE_ACROSS = ["img_staging", "img", "img_posted"]

def credit_filename(filename):
  """Rewrite downloader credit formats into the 'Photo by <name> - ...' form the prompt expects."""
  filename = re.sub(r'^(.*?)-(?:photo|video)-(.*?)$', r'Photo by \1 - \2', filename)
  return re.sub(r'^(?!Photo by )(.*) by @?(\S+?)(\.\w+)$', r'Photo by \2 - \1\3', filename)

def sniff_media_type(path, fallback):
  """Detect the real image type from magic bytes (some downloads are WebP saved as .jpg)."""
  with open(path, "rb") as f:
    head = f.read(12)
  if head[:3] == b"\xff\xd8\xff": return "image/jpeg"
  if head[:8] == b"\x89PNG\r\n\x1a\n": return "image/png"
  if head[:4] == b"RIFF" and head[8:12] == b"WEBP": return "image/webp"
  if head[:6] in (b"GIF87a", b"GIF89a"): return "image/gif"
  return fallback

def unique_name(label, ext, current):
  """`label + ext`, or `label~N + ext` if another file already has that name. The bot strips ~N from alt text."""
  taken = {unicodedata.normalize("NFC", f).lower()
           for d in UNIQUE_ACROSS if os.path.isdir(d)
           for f in os.listdir(d) if not (d == "img_staging" and f == current)}
  name, n = label + ext, 1
  while unicodedata.normalize("NFC", name).lower() in taken:
    n += 1
    name = f"{label}~{n}{ext}"
  return name

def video_frames(video_path, count=3):
  """Grab `count` evenly spaced JPEG frames from a video with ffmpeg."""
  duration = float(subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video_path],
    check=True, capture_output=True, text=True).stdout.strip())
  frames = []
  for i in range(1, count + 1):
    t = duration * i / (count + 1)
    frames.append(subprocess.run(
      ["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", video_path, "-frames:v", "1",
       "-vf", "scale='min(1280,iw)':-2", "-f", "image2", "-c:v", "mjpeg", "pipe:1"],
      check=True, capture_output=True).stdout)
  return frames

def generate_alt_text(image_path):

  def encode_image(image_path):
      with open(image_path, "rb") as image_file:
          return base64.b64encode(image_file.read()).decode("utf-8")

  ## Set the model name. Credentials come from the environment
  ## (ANTHROPIC_API_KEY, or an `ant auth login` profile).
  MODEL="claude-opus-5"
  client = anthropic.Anthropic()

  ext = os.path.splitext(image_path)[1].lower()
  if ext in VIDEO_EXTENSIONS:
    images = [("image/jpeg", base64.b64encode(f).decode("utf-8")) for f in video_frames(image_path)]
    prompt = "These are frames from one short video. Generate alt text for the video:"
  else:
    images = [(sniff_media_type(image_path, MEDIA_TYPES[ext]), encode_image(image_path))]
    prompt = "Generate alt text for this image:"

  message = client.beta.messages.create(
    model=MODEL,
    max_tokens=2000,
    output_config={"effort": "low"},
    betas=["server-side-fallback-2026-07-01"],
    fallbacks="default",
    system=f"You are an alt text generator assistant. You are asked to generate alt text for the image provided. Images are always photos of wombats, both common and hairy-nosed, but there may be other animals or people. All text should be consise, using only lowercase alphanumerical characters with no punctuation. Keep it under 100 characters. don't use the word cozy. its okay to have fun. if the original filename ({image_path}) contains a credit to the photographer (usually 'Photo by <photographer name>…'), add this credit to the end of the alt text, like '<alt text description> (credit: <photographer name>)', e.g. 'Wombat with grass on its head sitting on a log (credit: John Smith)'. Make sure to preserve the photographer's name exactly as it appears in the filename. The photographer name is the text between 'Photo by' and the first ' on <date>' or ' in <location>' or period, so always add the credit if the filename starts with 'Photo by'. If the filename does not contain a credit, do not add one. Reply with the alt text only.",
    messages=[
      {"role": "user", "content": [
        *[{"type": "image", "source": {"type": "base64", "media_type": mt, "data": data}}
          for mt, data in images],
        {"type": "text", "text": prompt}
      ]}
    ]
  )

  if message.stop_reason == "refusal":
    raise RuntimeError("model declined to describe this image")

  label = "".join(b.text for b in message.content if b.type == "text").strip()
  print(label)
  return label

if __name__ == "__main__":
  if  len(sys.argv) >= 2 and sys.argv[1] == "-h":
    print ("Usage: python labeler.py")
    print ("")
    print ("Renames images and .mp4 videos in img_staging to alt text generated by Claude (videos need ffmpeg)")
    sys.exit(0)
  if not (os.environ.get("ANTHROPIC_API_KEY", "")
          or os.environ.get("ANTHROPIC_AUTH_TOKEN", "")
          or os.path.isdir(os.path.expanduser("~/.config/anthropic"))):
    print ("Error: no Anthropic credentials found (set ANTHROPIC_API_KEY, or run `ant auth login`)")
    sys.exit(0)
  for filename in os.listdir("img_staging"):
    if os.path.splitext(filename)[1].lower() in {*MEDIA_TYPES, *VIDEO_EXTENSIONS}:
      try:
        print ("[old] " + filename)
        # if new filename format, change to match old downloader
        credit_transformed_filename = credit_filename(filename)
        os.rename("img_staging/" + filename, "img_staging/" + credit_transformed_filename)
        filename = credit_transformed_filename

        label = generate_alt_text("img_staging/" + filename)
        file_extension = os.path.splitext(filename)[1]
        
        if "/" in label or not label:
          raise ValueError("unusable label: " + repr(label))
        new_name = unique_name(label, file_extension, filename)
        os.rename("img_staging/" + filename, "img_staging/" + new_name)
        print ("[new] " + new_name + "\n")
      except Exception as e:
        print ("[error] failure"+ "\n")
        print (str(e) + "\n")
  