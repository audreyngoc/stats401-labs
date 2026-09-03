"""
Stats 401 - Lab 3
Web Data Acquisition: Biti's Product Catalog

This script uses Biti's public products.json endpoint to
collect product data, parse JSON, and save the results as CSV.
"""

import time
from pathlib import Path
from urllib.parse import urljoin
from urllib.robotparser import RobotFileParser

import pandas as pd
import requests


BASE_URL = "https://bitis.com.vn"

COLLECTIONS = [
    "/collections/all",
]

PRODUCTS_PER_REQUEST = 32
MAX_PAGES_PER_COLLECTION = 100
TARGET_RECORDS = 1000

REQUEST_DELAY = 1.0
TIMEOUT = 15

USER_AGENT = "STATS401-Class-Exercise/1.0"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
}


LAB3_DIR = Path(__file__).resolve().parent
REPO_DIR = LAB3_DIR.parent
DATA_DIR = REPO_DIR / "data"
OUTPUT_FILE = DATA_DIR / "lab3_data.csv"


def check_robots(url):
    """
    Check whether our User-Agent is allowed to access a URL
    according to Biti's robots.txt.
    """

    robots_url = urljoin(
        BASE_URL,
        "/robots.txt"
    )

    print(
        f"Checking robots.txt: {robots_url}"
    )

    rp = RobotFileParser()

    try:

        rp.set_url(robots_url)
        rp.read()

        allowed = rp.can_fetch(
            USER_AGENT,
            url
        )

        if allowed:
            print("robots.txt: access allowed")
        else:
            print("robots.txt: access NOT allowed")

        return allowed

    except Exception as error:

        print(
            "Could not read robots.txt:"
        )

        print(error)

        return False


def get_json(url, params=None):
    """
    Make an HTTP GET request and parse the response as JSON.
    """

    try:

        response = requests.get(
            url,
            headers=HEADERS,
            params=params,
            timeout=TIMEOUT
        )

        response.raise_for_status()

        print(
            f"HTTP {response.status_code}: "
            f"{response.url}"
        )

        return response.json()

    except requests.RequestException as error:

        print(
            f"Request failed: {url}"
        )

        print(
            f"Error: {error}"
        )

        return None

    except ValueError as error:

        print(
            f"Response was not valid JSON: {url}"
        )

        print(
            f"Error: {error}"
        )

        return None


def clean_price(value):
    """
    Convert a product price to an integer.
    """

    if value is None or value == "":
        return None

    try:
        return int(
            round(
                float(value)
            )
        )

    except (TypeError, ValueError):
        return None


def extract_image_url(product):
    """
    Extract the first available product image URL.

    Biti's product JSON may provide images as a list of
    image objects. This function handles common image fields.
    """

    images = product.get("images") or []

    if isinstance(images, list):

        for image in images:

            if isinstance(image, dict):

                image_url = (
                    image.get("src")
                    or image.get("url")
                )

                if image_url:
                    return urljoin(
                        BASE_URL,
                        image_url
                    )

            elif isinstance(image, str):

                return urljoin(
                    BASE_URL,
                    image
                )

    featured_image = product.get(
        "featured_image"
    )

    if isinstance(
        featured_image,
        dict
    ):

        image_url = (
            featured_image.get("src")
            or featured_image.get("url")
        )

        if image_url:

            return urljoin(
                BASE_URL,
                image_url
            )

    elif isinstance(
        featured_image,
        str
    ):

        return urljoin(
            BASE_URL,
            featured_image
        )

    image = product.get("image")

    if isinstance(
        image,
        dict
    ):

        image_url = (
            image.get("src")
            or image.get("url")
        )

        if image_url:

            return urljoin(
                BASE_URL,
                image_url
            )

    elif isinstance(
        image,
        str
    ):

        return urljoin(
            BASE_URL,
            image
        )

    return None


def extract_availability(product):
    """
    Determine whether the product is available.

    If the product-level availability field exists,
    use it. Otherwise, check the product variants.
    """

    if "available" in product:

        value = product.get(
            "available"
        )

        if isinstance(
            value,
            bool
        ):

            return (
                "Available"
                if value
                else "Unavailable"
            )

    variants = product.get(
        "variants"
    ) or []

    variant_availability = []

    for variant in variants:

        if not isinstance(
            variant,
            dict
        ):
            continue

        if "available" in variant:

            variant_availability.append(
                bool(
                    variant.get(
                        "available"
                    )
                )
            )

    if variant_availability:

        if any(
            variant_availability
        ):

            return "Available"

        return "Unavailable"

    return None


def extract_product_record(
    product,
    collection_source
):
    """
    Convert one product from Biti's JSON
    into one CSV record.
    """

    product_id = product.get(
        "id"
    )

    product_name = (
        product.get("title")
        or product.get("name")
        or ""
    ).strip()

    vendor = (
        product.get("vendor")
        or product.get("brand")
        or ""
    ).strip()

    product_type = (
        product.get("product_type")
        or product.get("category")
        or ""
    ).strip()

    tags = product.get(
        "tags"
    )

    if isinstance(
        tags,
        list
    ):

        tags = ", ".join(
            str(tag)
            for tag in tags
        )

    elif tags is not None:

        tags = str(tags)

    else:

        tags = ""

    variants = product.get(
        "variants"
    ) or []

    number_of_variants = len(
        variants
    )

    current_prices = []

    for variant in variants:

        if not isinstance(
            variant,
            dict
        ):
            continue

        price = clean_price(
            variant.get("price")
        )

        if price is not None:

            current_prices.append(
                price
            )

    if not current_prices:

        product_price = clean_price(
            product.get("price")
        )

        if product_price is not None:

            current_prices.append(
                product_price
            )

    price = (
        min(current_prices)
        if current_prices
        else None
    )

    handle = product.get(
        "handle"
    )

    product_url = None

    if handle:

        product_url = urljoin(
            BASE_URL,
            f"/products/{handle}"
        )

    image_url = extract_image_url(
        product
    )

    availability = extract_availability(
        product
    )

    return {
        "product_id": product_id,
        "product_name": product_name,
        "price": price,
        "vendor": vendor,
        "product_type": product_type,
        "tags": tags,
        "availability": availability,
        "number_of_variants": number_of_variants,
        "image_url": image_url,
        "product_url": product_url,
    }


def get_collection_page(
    collection_path,
    page
):
    """
    Request one page from Biti's products.json endpoint.
    """

    url = urljoin(
        BASE_URL,
        collection_path + "/products.json"
    )

    params = {
        "include": (
            "metafields"
            "[product,hrvmultilang_en]"
        ),
        "page": page,
        "limit": PRODUCTS_PER_REQUEST,
        "sort_by": "",
    }

    return get_json(
        url,
        params=params
    )


def extract_product_list(data):
    """
    Extract the product list from the JSON response.
    """

    if not isinstance(
        data,
        dict
    ):

        return []

    products = data.get(
        "products"
    )

    if isinstance(
        products,
        list
    ):

        return products

    for value in data.values():

        if isinstance(
            value,
            dict
        ):

            products = value.get(
                "products"
            )

            if isinstance(
                products,
                list
            ):

                return products

    return []


def scrape_collection(
    collection_path,
    remaining_target
):
    """
    Paginate through one Biti's products.json collection.
    """

    records = []

    seen_ids = set()
    seen_urls = set()

    print()
    print(
        f"Starting collection: "
        f"{collection_path}"
    )

    for page in range(
        1,
        MAX_PAGES_PER_COLLECTION + 1
    ):

        if len(records) >= remaining_target:

            break

        api_url = urljoin(
            BASE_URL,
            collection_path
            + "/products.json"
        )

        if not check_robots(
            api_url
        ):

            print(
                "Skipping this collection "
                "because robots.txt does "
                "not permit access."
            )

            break

        print()
        print(
            f"Collection API page {page}:"
        )

        data = get_collection_page(
            collection_path,
            page
        )

        if data is None:

            print(
                "Could not retrieve JSON data."
            )

            break

        products = extract_product_list(
            data
        )

        if not products:

            print(
                "No products returned."
            )

            print(
                "Pagination appears to have ended."
            )

            break

        page_new_records = 0

        for product in products:

            record = extract_product_record(
                product,
                collection_path
            )

            product_id = record[
                "product_id"
            ]

            product_url = record[
                "product_url"
            ]

            if product_id is not None:

                if product_id in seen_ids:

                    continue

                seen_ids.add(
                    product_id
                )

            elif product_url:

                if product_url in seen_urls:

                    continue

                seen_urls.add(
                    product_url
                )

            else:

                continue

            records.append(
                record
            )

            page_new_records += 1

            if len(records) >= remaining_target:

                break

        print(
            f"Products returned by API: "
            f"{len(products)}"
        )

        print(
            f"New products added: "
            f"{page_new_records}"
        )

        print(
            f"Unique products from this "
            f"collection: {len(records)}"
        )

        if len(products) < PRODUCTS_PER_REQUEST:

            print(
                "Fewer than "
                f"{PRODUCTS_PER_REQUEST} products "
                "returned."
            )

            print(
                "Pagination appears to have ended."
            )

            break

        if page_new_records == 0:

            print(
                "No new products found."
            )

            print(
                "Stopping pagination."
            )

            break

        print(
            f"Waiting {REQUEST_DELAY} second..."
        )

        time.sleep(
            REQUEST_DELAY
        )

    return records


def main():

    print(
        "STATS 401 - Lab 3"
    )

    print(
        "Biti's Web Data Acquisition"
    )

    print()

    print(
        f"Target records: {TARGET_RECORDS}"
    )

    print(
        f"Products per API request: "
        f"{PRODUCTS_PER_REQUEST}"
    )

    print(
        f"Output file: {OUTPUT_FILE}"
    )

    robots_homepage = check_robots(
        BASE_URL
    )

    if not robots_homepage:

        print()
        print(
            "Automated access is not permitted "
            "according to robots.txt."
        )

        print(
            "The scraper will stop."
        )

        return

    all_records = []

    for collection in COLLECTIONS:

        remaining_target = (
            TARGET_RECORDS
            - len(all_records)
        )

        if remaining_target <= 0:

            break

        records = scrape_collection(
            collection,
            remaining_target
        )

        all_records.extend(
            records
        )

        print()

        print(
            f"Finished {collection}: "
            f"{len(records)} new records"
        )

        print(
            f"Overall unique records: "
            f"{len(all_records)}"
        )

        if len(all_records) < TARGET_RECORDS:

            time.sleep(
                REQUEST_DELAY
            )

    if not all_records:

        print()
        print(
            "No records were collected."
        )

        return

    df = pd.DataFrame(
        all_records
    )

    before_deduplication = len(df)

    df = df.drop_duplicates(
        subset=["product_id"]
    ).copy()

    after_deduplication = len(df)

    duplicates_removed = (
        before_deduplication
        - after_deduplication
    )

    print()
    print(
        f"Records before deduplication: "
        f"{before_deduplication}"
    )

    print(
        f"Duplicates removed: "
        f"{duplicates_removed}"
    )

    print(
        f"Unique products: "
        f"{after_deduplication}"
    )

    columns = [
        "product_id",
        "product_name",
        "price",
        "vendor",
        "product_type",
        "tags",
        "availability",
        "number_of_variants",
        "image_url",
        "product_url",
    ]

    df = df[columns]

    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False,
        encoding="utf-8-sig"
    )

    print()
    print(
        "FINAL RESULTS"
    )

    print(
        f"Records collected: {len(df)}"
    )

    print(
        f"CSV saved to: {OUTPUT_FILE}"
    )

    print()
    print(
        "Columns:"
    )

    for column in df.columns:

        print(
            f"  - {column}"
        )

    print()
    print(
        "First five records:"
    )

    print(
        df.head().to_string(
            index=False
        )
    )

    print()

    if len(df) >= TARGET_RECORDS:

        print(
            "SUCCESS!"
        )

        print(
            "The dataset contains at least "
            f"{TARGET_RECORDS} unique records."
        )

    else:

        print(
            "WARNING"
        )

        print(
            f"The dataset currently contains "
            f"{len(df)} unique records."
        )

        print(
            f"The Lab 3 target is at least "
            f"{TARGET_RECORDS} records."
        )


if __name__ == "__main__":
    main()