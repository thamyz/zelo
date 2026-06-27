#!/usr/bin/env python3
"""Minimal static file server for the Zelo preview.

Uses an absolute root so it never calls os.getcwd() (blocked under the
preview sandbox). Run: python3 serve.py [port]
"""
import functools
import http.server
import socketserver
import sys

ROOT = "/Volumes/PBE Main HD/VSC/ChatPracticeWeb"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)


class Server(socketserver.TCPServer):
    allow_reuse_address = True


with Server(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving {ROOT} at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
