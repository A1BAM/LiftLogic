import urllib.request
import json
import urllib.parse
import sys

def search_docs(query):
    url = f"https://developers.cloudflare.com/search.json"
    print("Let's try a google search via duckduckgo lite:")
    url_ddg = f"https://lite.duckduckgo.com/lite/"
    data = urllib.parse.urlencode({'q': query}).encode('utf-8')
    req = urllib.request.Request(url_ddg, data=data, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        for a in soup.find_all('a', class_='result-snippet'):
            print(a.text)
    except Exception as e:
        print(e)

search_docs("site:developers.cloudflare.com/images/ image resizing trim color")
