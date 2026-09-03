d3.csv("../data/lab3_data.csv")
    .then(data => {

        const columns = [
            "image_url",
            "product_id",
            "product_name",
            "price",
            "vendor",
            "product_type",
            "availability",
            "number_of_variants",
            "product_url"
        ];

        data.forEach(d => {

            d.product_id = +d.product_id;

            d.price = d.price
                ? +d.price
                : null;

            d.number_of_variants =
                d.number_of_variants
                    ? +d.number_of_variants
                    : null;
        });

        const table = d3.select(
            "#data-table"
        );

        const tableContainer = d3.select(
            ".table-container"
        );

        const searchContainer = d3.select(
            "#acquired-data"
        )
        .insert("div", ".table-container")
        .attr(
            "class",
            "table-controls"
        );

        searchContainer
            .append("label")
            .attr(
                "for",
                "product-search"
            )
            .text(
                "Search products"
            );

        const searchInput =
            searchContainer
                .append("input")
                .attr(
                    "id",
                    "product-search"
                )
                .attr(
                    "type",
                    "search"
                )
                .attr(
                    "placeholder",
                    "Search by product name..."
                )
                .attr(
                    "aria-label",
                    "Search products by name"
                );

        const resultCount =
            searchContainer
                .append("span")
                .attr(
                    "class",
                    "search-result-count"
                );

        const header = table
            .select("thead")
            .append("tr");

        let sortColumn = null;
        let sortAscending = true;

        header
            .selectAll("th")
            .data(columns)
            .join("th")
            .text(
                d => formatColumnName(d)
            )
            .attr(
                "aria-sort",
                "none"
            )
            .attr(
                "scope",
                "col"
            )
            .style(
                "cursor",
                "pointer"
            )
            .on(
                "click",
                function(event, column) {

                    if (
                        sortColumn === column
                    ) {

                        sortAscending =
                            !sortAscending;

                    } else {

                        sortColumn = column;
                        sortAscending = true;
                    }

                    header
                        .selectAll("th")
                        .attr(
                            "aria-sort",
                            "none"
                        );

                    d3.select(this)
                        .attr(
                            "aria-sort",
                            sortAscending
                                ? "ascending"
                                : "descending"
                        );

                    updateRows(
                        searchInput
                            .node()
                            .value
                    );
                }
            );

        searchInput.on(
            "input",
            function() {

                updateRows(
                    this.value
                );
            }
        );

        function getFilteredData(
            searchTerm
        ) {

            const term =
                searchTerm
                    .trim()
                    .toLowerCase();

            if (!term) {

                return data;
            }

            return data.filter(
                d => {

                    const name =
                        String(
                            d.product_name
                            ?? ""
                        ).toLowerCase();

                    return name.includes(
                        term
                    );
                }
            );
        }

        function updateRows(
            searchTerm = ""
        ) {

            let displayedData =
                getFilteredData(
                    searchTerm
                );

            if (sortColumn) {

                displayedData = [
                    ...displayedData
                ].sort(
                    (a, b) => {

                        const aValue =
                            a[sortColumn];

                        const bValue =
                            b[sortColumn];

                        if (
                            typeof aValue === "number"
                            &&
                            typeof bValue === "number"
                        ) {

                            return sortAscending
                                ? d3.ascending(
                                    aValue,
                                    bValue
                                )
                                : d3.descending(
                                    aValue,
                                    bValue
                                );
                        }

                        const aText =
                            String(
                                aValue ?? ""
                            );

                        const bText =
                            String(
                                bValue ?? ""
                            );

                        return sortAscending
                            ? d3.ascending(
                                aText,
                                bText
                            )
                            : d3.descending(
                                aText,
                                bText
                            );
                    }
                );
            }

            const rows = table
                .select("tbody")
                .selectAll("tr")
                .data(
                    displayedData,
                    d => d.product_id
                );

            rows
                .join("tr")
                .each(
                    function(row) {

                        const cells =
                            d3.select(this)
                                .selectAll("td")
                                .data(
                                    columns.map(
                                        column =>
                                            row[column]
                                    )
                                )
                                .join("td");

                        cells
                            .text("");

                        cells.each(
                            function(
                                value,
                                index
                            ) {

                                const cell =
                                    d3.select(this);

                                const column =
                                    columns[index];

                                if (
                                    column ===
                                    "image_url"
                                ) {

                                    if (value) {

                                        cell
                                            .append("img")
                                            .attr(
                                                "src",
                                                value
                                            )
                                            .attr(
                                                "alt",
                                                row.product_name
                                                || "Product image"
                                            )
                                            .attr(
                                                "loading",
                                                "lazy"
                                            )
                                            .attr(
                                                "width",
                                                70
                                            )
                                            .attr(
                                                "height",
                                                70
                                            )
                                            .style(
                                                "width",
                                                "70px"
                                            )
                                            .style(
                                                "height",
                                                "70px"
                                            )
                                            .style(
                                                "object-fit",
                                                "contain"
                                            )
                                            .style(
                                                "border-radius",
                                                "6px"
                                            );
                                    } else {

                                        cell.text(
                                            "—"
                                        );
                                    }

                                    return;
                                }

                                if (
                                    column ===
                                    "price"
                                ) {

                                    if (
                                        value === null
                                        ||
                                        value === undefined
                                        ||
                                        Number.isNaN(
                                            value
                                        )
                                    ) {

                                        cell.text(
                                            "—"
                                        );

                                    } else {

                                        cell.text(
                                            d3.format(
                                                ",.0f"
                                            )(value)
                                            + " ₫"
                                        );
                                    }

                                    return;
                                }

                                if (
                                    column ===
                                    "number_of_variants"
                                ) {

                                    if (
                                        value === null
                                        ||
                                        value === undefined
                                        ||
                                        Number.isNaN(
                                            value
                                        )
                                    ) {

                                        cell.text(
                                            "—"
                                        );

                                    } else {

                                        cell.text(
                                            d3.format(
                                                ","
                                            )(value)
                                        );
                                    }

                                    return;
                                }

                                if (
                                    column ===
                                    "product_url"
                                ) {

                                    if (value) {

                                        cell
                                            .append("a")
                                            .attr(
                                                "href",
                                                value
                                            )
                                            .attr(
                                                "target",
                                                "_blank"
                                            )
                                            .attr(
                                                "rel",
                                                "noopener noreferrer"
                                            )
                                            .attr(
                                                "class",
                                                "product-link"
                                            )
                                            .text(
                                                "View product"
                                            );

                                    } else {

                                        cell.text(
                                            "—"
                                        );
                                    }

                                    return;
                                }

                                cell.text(
                                    value ?? "—"
                                );
                            }
                        );
                    }
                );

            resultCount.text(
                `${d3.format(",")(
                    displayedData.length
                )} ${
                    displayedData.length === 1
                        ? "product"
                        : "products"
                }`
            );
        }

        function formatColumnName(
            column
        ) {

            const names = {

                image_url:
                    "Image",

                product_id:
                    "Product ID",

                product_name:
                    "Product Name",

                price:
                    "Price",

                vendor:
                    "Brand/Vendor",

                product_type:
                    "Category",

                availability:
                    "Availability",

                number_of_variants:
                    "Variants",

                product_url:
                    "Product URL"
            };

            return names[column]
                || column;
        }

        updateRows();

        tableContainer
            .attr(
                "aria-label",
                "Sortable Biti's product table"
            );

        d3.select("head")
            .append("style")
            .text(`
                #acquired-data {
                    --table-border: #e5e7eb;
                    --table-header: #f3f4f6;
                    --table-header-text: #202428;
                    --table-hover: #f8fafc;
                    --table-text: #25282b;
                    --table-muted: #687078;
                }

                .table-controls {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin: 16px 0 12px;
                    flex-wrap: wrap;
                }

                .table-controls label {
                    font-weight: 600;
                    color: var(--table-text);
                }

                #product-search {
                    width: min(360px, 100%);
                    padding: 9px 12px;
                    border: 1px solid #d6d9dd;
                    border-radius: 6px;
                    background: #fff;
                    color: var(--table-text);
                    font: inherit;
                    outline: none;
                }

                #product-search:focus {
                    border-color: #8b9198;
                    box-shadow:
                        0 0 0 2px
                        rgba(0, 0, 0, 0.06);
                }

                .search-result-count {
                    color: var(--table-muted);
                    font-size: 13px;
                }

                /* Scrollable table area */
                .table-container {
                    max-height: 650px;
                    overflow-y: auto;
                    overflow-x: auto;
                    border: 1px solid var(--table-border);
                    border-radius: 8px;
                    background: #fff;
                }

                #data-table {
                    width: 100%;
                    min-width: 950px;
                    border-collapse: separate;
                    border-spacing: 0;
                    color: var(--table-text);
                    background: #fff;
                }

                /* Professional sticky header */
                #data-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 10;

                    background: var(--table-header);
                    color: var(--table-header-text);

                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.01em;

                    text-align: left;
                    white-space: nowrap;

                    padding: 13px 14px;

                    border-bottom:
                        2px solid
                        #d1d5db;

                    box-shadow:
                        0 1px 0
                        rgba(0, 0, 0, 0.03);
                }

                #data-table tbody td {
                    padding: 11px 14px;
                    border-bottom:
                        1px solid
                        var(--table-border);

                    vertical-align: middle;
                    background: #fff;
                }

                #data-table tbody tr:last-child td {
                    border-bottom: none;
                }

                #data-table tbody tr:hover td {
                    background-color:
                        var(--table-hover);
                }

                /* Sort indicators */
                #data-table th::after {
                    content: "";
                    display: inline-block;
                    margin-left: 7px;
                    opacity: 0;
                    font-size: 12px;
                }

                #data-table th[aria-sort="ascending"]::after {
                    content: "↑";
                    opacity: 1;
                }

                #data-table th[aria-sort="descending"]::after {
                    content: "↓";
                    opacity: 1;
                }

                #data-table th:hover {
                    background-color: #e9ebee;
                }

                #data-table td:nth-child(1) {
                    width: 90px;
                    min-width: 90px;
                    text-align: center;
                }

                #data-table td:nth-child(2),
                #data-table td:nth-child(4),
                #data-table td:nth-child(7),
                #data-table td:nth-child(8) {
                    white-space: nowrap;
                }

                #data-table td:nth-child(2) {
                    color: #5f666d;
                    font-variant-numeric: tabular-nums;
                }

                #data-table td:nth-child(4) {
                    font-weight: 600;
                    text-align: right;
                    font-variant-numeric: tabular-nums;
                }

                #data-table td:nth-child(7) {
                    text-align: center;
                }

                #data-table td:nth-child(8) {
                    text-align: center;
                    font-variant-numeric: tabular-nums;
                }

                #data-table td:nth-child(9) {
                    white-space: nowrap;
                }

                #data-table img {
                    display: block;
                    margin: auto;
                }

                .product-link {
                    color: inherit;
                    font-weight: 600;
                    text-decoration: none;
                }

                .product-link:hover {
                    text-decoration: underline;
                }

                /* Keep the header visually above the rows */
                #data-table thead {
                    position: relative;
                    z-index: 10;
                }

                /* Scrollbar styling */
                .table-container::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }

                .table-container::-webkit-scrollbar-track {
                    background: #f5f6f7;
                }

                .table-container::-webkit-scrollbar-thumb {
                    background: #c7cbd0;
                    border-radius: 5px;
                }

                .table-container::-webkit-scrollbar-thumb:hover {
                    background: #aeb3b9;
                }
            `);
    })
    .catch(error => {

        console.error(
            "Error loading dataset:",
            error
        );

        d3.select("#data-table")
            .append("caption")
            .text(
                "Unable to load the dataset."
            );
    });