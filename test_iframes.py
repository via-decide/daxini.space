import urllib.request
import ssl
import json

urls = [
    # News / Feed
    "https://lobste.rs/",
    "https://news.ycombinator.com/",
    "https://dev.to/",
    "https://hckrnews.com/",
    "https://thehackernews.com/",
    "https://hn.algolia.com/",
    
    # Lab / AI
    "https://huggingface.co/spaces",
    "https://huggingface.co/chat/",
    "https://ollama.com/",
    "https://localai.io/",
    "https://replicate.com/",
    "https://gradio.app/",
    "https://streamlit.io/",
    
    # Databases
    "https://ourworldindata.org/",
    "https://data.gov/",
    "https://kaggle.com/",
    "https://db-engines.com/en/",
    
    # Knowledge Base
    "https://wikipedia.org/",
    "https://en.wikipedia.org/wiki/Main_Page",
    "https://developer.mozilla.org/en-US/",
    "https://docs.python.org/3/",
    "https://react.dev/",
    "https://vuejs.org/",
    "https://readthedocs.org/",
    
    # Audit / Analytics
    "https://grafana.com/",
    "https://play.grafana.org/",
    "https://app.posthog.com/",
    "https://netdata.cloud/"
]

results = {"allowed": [], "blocked": [], "error": []}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {'User-Agent': 'Mozilla/5.0'}

for url in urls:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            xfo = response.headers.get('X-Frame-Options', '').upper()
            csp = response.headers.get('Content-Security-Policy', '').upper()
            
            is_blocked = False
            if 'DENY' in xfo or 'SAMEORIGIN' in xfo:
                is_blocked = True
            if 'FRAME-ANCESTORS' in csp:
                is_blocked = True
                
            if is_blocked:
                results["blocked"].append(url)
            else:
                results["allowed"].append(url)
    except Exception as e:
        results["error"].append(f"{url} ({str(e)})")

print(json.dumps(results, indent=2))
