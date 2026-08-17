import os, sys, functools
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = sys.argv[1]
PORT = int(sys.argv[2])


class SPAHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) or (os.path.isdir(p) and not os.path.exists(os.path.join(p, "index.html"))):
            return os.path.join(ROOT, "index.html")
        return p

    def log_message(self, *args):
        pass


handler = functools.partial(SPAHandler, directory=ROOT)
HTTPServer(("127.0.0.1", PORT), handler).serve_forever()
