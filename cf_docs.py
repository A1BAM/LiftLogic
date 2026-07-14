import urllib.request
import json
import urllib.parse
from bs4 import BeautifulSoup

def search_cf_docs(query):
    url = f"https://developers.cloudflare.com/search.json"

search_cf_docs("trim color")
