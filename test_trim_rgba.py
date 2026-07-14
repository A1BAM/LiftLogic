import urllib.request

url = "https://developers.cloudflare.com/images/transform-images/transform-via-workers/"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    import re
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    for p in soup.find_all(['p', 'li']):
        if 'trim' in p.text.lower() or 'border' in p.text.lower():
            print(p.text)
except Exception as e:
    print(e)
