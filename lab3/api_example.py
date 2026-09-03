import requests

url = "https://example.com"

headers = {
    "User-Agent": "STATS401-Class-Exercise/1.0"
}

# 2.1 Send request
response = requests.get(
    url,
    headers=headers,
    timeout=10
)

response.raise_for_status()

# 2.2 Inspect response
print(response.status_code)
print(response.text)