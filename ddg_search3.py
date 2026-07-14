import urllib.request
import urllib.parse
from bs4 import BeautifulSoup

def search(query):
    url = f"https://lite.duckduckgo.com/lite/"
    data = urllib.parse.urlencode({'q': query}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        for td in soup.find_all('td', class_='result-snippet'):
            print(td.text.strip())
    except Exception as e:
        print(e)

search("cloudflare image resizing trim CSS color")
