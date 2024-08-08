from openai import OpenAI 
import os, sys
import base64

def generate_alt_text(image_path):

  def encode_image(image_path):
      with open(image_path, "rb") as image_file:
          return base64.b64encode(image_file.read()).decode("utf-8")

  ## Set the API key and model name
  MODEL="gpt-4o-mini"
  client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

  completion = client.chat.completions.create(
    model=MODEL,
    messages=[
      {"role": "system", "content": "You are an alt text generator assistant. You are asked to generate alt text for the image provided. Images are always photos of wombats, both common and hairy-nosed. All text should be consise, using only lowercase alphanumerical characters with no punctuation. Keep it under 120 characters."},
      {"role": "user", "content": [
        {"type": "text", "text": "Generate alt text for this image:"},
        {"type": "image_url", "image_url": {
          "url": f"data:image/png;base64,{encode_image(image_path)}"}
        }
      ]}
    ]
  )

  return completion.choices[0].message.content

if __name__ == "__main__":
  if  len(sys.argv) >= 2 and sys.argv[1] == "-h":
    print ("Usage: python labeler.py")
    print ("")
    print ("Renames files in img_staging to alt text generated by GPT4o")
    sys.exit(0)
  for filename in os.listdir("img_staging"):
    if filename.endswith(".png") or filename.endswith(".jpg"):
      print ("[old] " + filename)
      label = generate_alt_text("img_staging/" + filename)
      file_extension = os.path.splitext(filename)[1]
      
      os.rename("img_staging/" + filename, "img_staging/" + label + file_extension)
      print ("[new] " + label + file_extension + "\n")
  