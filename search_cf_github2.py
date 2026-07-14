import urllib.request
import json
import base64

url = "https://api.github.com/search/code?q=repo:cloudflare/cloudflare-docs+path:content+trim"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    for item in data.get('items', []):
        print(item['path'])
except Exception as e:
    print(e)
