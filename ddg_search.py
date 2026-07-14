import urllib.request
import urllib.parse
from bs4 import BeautifulSoup

def search(query):
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        soup = BeautifulSoup(html, 'html.parser')
        for a in soup.find_all('a', class_='result__snippet'):
            print(a.text)
    except Exception as e:
        print(e)

search("site:developers.cloudflare.com/images/ trim border color CSS hex rgb rgba")
