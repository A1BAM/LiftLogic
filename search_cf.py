import urllib.request
import json
import re

url = "https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/content/images/transform-images/transform-via-workers.md"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    for line in html.split('\n'):
        if 'trim' in line.lower() or 'color' in line.lower():
            print(line)
except Exception as e:
    print(e)
