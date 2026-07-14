import urllib.request
import json
import base64

url = "https://api.github.com/repos/cloudflare/cloudflare-docs/contents/content/images/transform-images/transform-via-workers.md"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    content = base64.b64decode(data['content']).decode('utf-8')
    for i, line in enumerate(content.split('\n')):
        if 'trim' in line.lower() or 'border' in line.lower():
            print(f"{i}: {line}")
except Exception as e:
    print(e)
