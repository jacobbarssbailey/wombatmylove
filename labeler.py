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
  if len(sys.argv) != 2 or sys.argv[1] == "-h" or sys.argv[1] == "--help":
    print ("Usage: python labeler.py [image_path]")
    print ("")
    print ("Renames file to alt text generated by GPT4o")
    sys.exit(0)
  print ("[old] " + sys.argv[1])
  label = generate_alt_text(sys.argv[1])
  file_extension = os.path.splitext(sys.argv[1])[1]
  os.rename(sys.argv[1], label + file_extension)
  print ("[new] " + label + file_extension + "\n")
  