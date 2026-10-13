import os
import re

import pandas as pd
import pymupdf


PDF_URL = (
    "https://dku-web-admissions.s3.cn-north-1.amazonaws.com.cn/"
    "dkumain/files/V2021-22_DKU_UG_Bulletin.pdf"
)

PDF_FILE = "../data/dku_bulletin.pdf"
OUTPUT_FILE = "../data/bulletin_passages.csv"


def download_pdf():
    if os.path.exists(PDF_FILE):
        print("PDF already exists.")
        return

    import requests

    print("Downloading bulletin...")

    response = requests.get(
        PDF_URL,
        timeout=60
    )

    response.raise_for_status()

    with open(
        PDF_FILE,
        "wb"
    ) as file:
        file.write(response.content)

    print("PDF downloaded.")


def clean_text(text):
    text = text.replace(
        "\u00ad",
        ""
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


def normalize_heading(text):
    text = clean_text(text)

    text = re.sub(
        r"\.{3,}\s*\d+$",
        "",
        text
    )

    text = re.sub(
        r"\s+\d+$",
        "",
        text
    )

    return text.strip().lower()


def is_page_number(text):
    return bool(
        re.fullmatch(
            r"(?:page\s+)?\d+",
            text,
            flags=re.IGNORECASE
        )
    )


def get_document_outline(doc):
    toc = doc.get_toc(
        simple=True
    )

    outline = []

    for level, title, page in toc:

        title = clean_text(
            title
        )

        if not title:
            continue

        outline.append(
            {
                "level": int(level),
                "title": title,
                "page": max(
                    int(page),
                    1
                )
            }
        )

    return outline


def find_content_start(outline):
    level_one_pages = [
        entry["page"]
        for entry in outline
        if entry["level"] == 1
    ]

    if not level_one_pages:
        return 1

    return min(
        level_one_pages
    )


def build_page_outline(
    outline,
    total_pages
):
    page_entries = [
        []
        for _ in range(
            total_pages + 1
        )
    ]

    for entry in outline:

        page = entry["page"]

        if 1 <= page <= total_pages:
            page_entries[page].append(
                entry
            )

    return page_entries


def get_hierarchy(
    outline,
    current_page
):
    chapter = "Unclassified"
    section = "Unclassified"
    subsection = "Unclassified"

    for entry in outline:

        if entry["page"] > current_page:
            break

        level = entry["level"]
        title = entry["title"]

        if level == 1:
            chapter = title
            section = "Unclassified"
            subsection = "Unclassified"

        elif level == 2:
            section = title
            subsection = "Unclassified"

        elif level == 3:
            subsection = title

    return (
        chapter,
        section,
        subsection
    )


def is_heading(
    text,
    outline_titles
):
    normalized = normalize_heading(
        text
    )

    return normalized in outline_titles


def is_noise_block(text):
    normalized = clean_text(
        text
    )

    if not normalized:
        return True

    if is_page_number(
        normalized
    ):
        return True

    if re.fullmatch(
        r"[\W_]+",
        normalized
    ):
        return True

    return False


def looks_like_metadata(text):
    words = text.split()

    if len(words) <= 4:
        return True

    if len(words) <= 8:
        if not re.search(
            r"[.!?:;]$",
            text
        ):
            return True

    return False


def should_join_blocks(
    previous,
    current,
    outline_titles
):
    previous_text = previous["text"]
    current_text = current["text"]

    if is_heading(
        previous_text,
        outline_titles
    ):
        return False

    if is_heading(
        current_text,
        outline_titles
    ):
        return False

    if is_noise_block(
        current_text
    ):
        return False

    vertical_gap = (
        current["y0"]
        - previous["y1"]
    )

    previous_words = len(
        previous_text.split()
    )

    current_words = len(
        current_text.split()
    )

    previous_ends_sentence = bool(
        re.search(
            r"[.!?:;]$",
            previous_text
        )
    )

    current_starts_lowercase = (
        current_text[:1].islower()
    )

    if vertical_gap <= 8:
        return True

    if (
        vertical_gap <= 16
        and not previous_ends_sentence
    ):
        return True

    if (
        vertical_gap <= 20
        and current_starts_lowercase
    ):
        return True

    if (
        previous_words <= 8
        and current_words <= 20
        and vertical_gap <= 18
    ):
        return True

    return False


def merge_blocks(
    blocks,
    outline_titles
):
    if not blocks:
        return []

    merged = []

    current = blocks[0].copy()

    for next_block in blocks[1:]:

        if should_join_blocks(
            current,
            next_block,
            outline_titles
        ):

            current["text"] = (
                current["text"]
                + " "
                + next_block["text"]
            )

            current["y1"] = (
                next_block["y1"]
            )

        else:
            merged.append(
                current
            )

            current = next_block.copy()

    merged.append(
        current
    )

    return merged


def extract_page_blocks(
    page,
    outline_titles
):
    raw_blocks = page.get_text(
        "blocks",
        sort=True
    )

    blocks = []

    for block in raw_blocks:

        if len(block) < 5:
            continue

        x0, y0, x1, y1, text = (
            block[:5]
        )

        text = clean_text(
            text
        )

        if is_noise_block(
            text
        ):
            continue

        blocks.append(
            {
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1,
                "text": text
            }
        )

    return merge_blocks(
        blocks,
        outline_titles
    )


def extract_passages(
    doc,
    outline,
    content_start
):
    passages = []

    outline_titles = {
        normalize_heading(
            entry["title"]
        )
        for entry in outline
    }

    for page_number in range(
        content_start,
        len(doc) + 1
    ):

        page = doc[
            page_number - 1
        ]

        chapter, section, subsection = (
            get_hierarchy(
                outline,
                page_number
            )
        )

        blocks = extract_page_blocks(
            page,
            outline_titles
        )

        for block in blocks:

            text = clean_text(
                block["text"]
            )

            if not text:
                continue

            if is_heading(
                text,
                outline_titles
            ):
                continue

            words = text.split()

            if len(words) < 8:
                continue

            passages.append(
                {
                    "chapter": chapter,
                    "section": section,
                    "subsection": subsection,
                    "page": page_number,
                    "text": text
                }
            )

    return passages


def clean_passages(
    passages
):
    df = pd.DataFrame(
        passages
    )

    if df.empty:
        raise ValueError(
            "No passages were extracted."
        )

    df["text"] = (
        df["text"]
        .astype(str)
        .str.replace(
            r"\s+",
            " ",
            regex=True
        )
        .str.strip()
    )

    df = df[
        df["text"].str.len() > 0
    ].copy()

    df = df.drop_duplicates(
        subset=["text"]
    ).copy()

    df.insert(
        0,
        "passage_id",
        [
            f"P{i:04d}"
            for i in range(
                1,
                len(df) + 1
            )
        ]
    )

    return df


def print_summary(df):
    print()
    print("Corpus summary")
    print("-------------------------")

    print(
        f"Passages: {len(df)}"
    )

    print(
        f"Chapters: "
        f"{df['chapter'].nunique()}"
    )

    print(
        f"Formal sections: "
        f"{df['section'].nunique()}"
    )

    print(
        f"Subsections: "
        f"{df['subsection'].nunique()}"
    )

    print(
        f"Pages represented: "
        f"{df['page'].nunique()}"
    )

    average_words = (
        df["text"]
        .str.split()
        .str.len()
        .mean()
    )

    print(
        f"Average passage length: "
        f"{average_words:.1f} words"
    )

    print()
    print("Top formal sections:")

    print(
        df["section"]
        .value_counts()
        .head(20)
    )

    print()
    print("Sample passages:")

    for _, row in df.head(5).iterrows():

        print()

        print(
            f"[{row['passage_id']}] "
            f"{row['chapter']} | "
            f"{row['section']} | "
            f"{row['subsection']} | "
            f"Page {row['page']}"
        )

        print(
            row["text"][:600]
        )


def main():
    download_pdf()

    print()
    print("Opening bulletin...")

    doc = pymupdf.open(
        PDF_FILE
    )

    print(
        f"Pages found: {len(doc)}"
    )

    print()
    print("Reading PDF outline...")

    outline = get_document_outline(
        doc
    )

    print(
        f"Outline entries found: "
        f"{len(outline)}"
    )

    print()
    print("Outline levels:")

    level_counts = (
        pd.Series(
            [
                entry["level"]
                for entry in outline
            ]
        )
        .value_counts()
        .sort_index()
    )

    print(
        level_counts
    )

    content_start = find_content_start(
        outline
    )

    print()
    print(
        f"Content starts at PDF page "
        f"{content_start}"
    )

    print()
    print(
        "Extracting and grouping "
        "PDF text blocks..."
    )

    passages = extract_passages(
        doc,
        outline,
        content_start
    )

    print(
        f"Raw extracted passages: "
        f"{len(passages)}"
    )

    print()
    print("Cleaning corpus...")

    df = clean_passages(
        passages
    )

    print_summary(
        df
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False,
        encoding="utf-8"
    )

    print()
    print("Saved:")

    print(
        os.path.abspath(
            OUTPUT_FILE
        )
    )

    doc.close()


if __name__ == "__main__":
    main()