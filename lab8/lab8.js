const mapContainer = d3.select("#semantic-map");
const detailPanel = d3.select("#detail-panel");
const searchInput = d3.select("#search");
const sectionFilter = d3.select("#section-filter");
const topicFilter = d3.select("#topic-filter");
const resetButton = d3.select("#reset-filters");
const tooltip = d3.select("#tooltip");

const width = 1000;
const height = 650;

const margin = {
    top: 40,
    right: 30,
    bottom: 50,
    left: 60
};

const chartWidth =
    width - margin.left - margin.right;

const chartHeight =
    height - margin.top - margin.bottom;

let allData = [];
let matrixData = [];
let corpusStats = [];

let points;
let selectedPoint = null;
let selectedNeighbors = [];
let selectedMatrixCell = null;

let xScale;
let yScale;
let radiusScale;

const colorScale = d3.scaleOrdinal(
    d3.schemeTableau10
);

const svg = mapContainer
    .append("svg")
    .attr(
        "viewBox",
        `0 0 ${width} ${height}`
    )
    .attr(
        "preserveAspectRatio",
        "xMidYMid meet"
    );

const chart = svg
    .append("g")
    .attr(
        "transform",
        `translate(${margin.left},${margin.top})`
    );

const plot = chart
    .append("g")
    .attr(
        "class",
        "semantic-points"
    );

const xAxisGroup = chart
    .append("g")
    .attr(
        "class",
        "x-axis"
    )
    .attr(
        "transform",
        `translate(0,${chartHeight})`
    );

const yAxisGroup = chart
    .append("g")
    .attr(
        "class",
        "y-axis"
    );

chart
    .append("text")
    .attr(
        "class",
        "axis-label"
    )
    .attr(
        "x",
        chartWidth / 2
    )
    .attr(
        "y",
        chartHeight + 42
    )
    .attr(
        "text-anchor",
        "middle"
    )
    .text(
        "UMAP Dimension 1"
    );

chart
    .append("text")
    .attr(
        "class",
        "axis-label"
    )
    .attr(
        "transform",
        `translate(-45,${chartHeight / 2}) rotate(-90)`
    )
    .attr(
        "text-anchor",
        "middle"
    )
    .text(
        "UMAP Dimension 2"
    );

const zoomLayer = chart
    .append("rect")
    .attr(
        "class",
        "zoom-layer"
    )
    .attr(
        "width",
        chartWidth
    )
    .attr(
        "height",
        chartHeight
    )
    .attr(
        "fill",
        "transparent"
    )
    .style(
        "pointer-events",
        "all"
    );

const zoom = d3.zoom()
    .scaleExtent([
        0.7,
        12
    ])
    .on(
        "zoom",
        event => {
            plot.attr(
                "transform",
                event.transform
            );
        }
    );

svg.call(zoom);

zoomLayer.lower();

Promise.all([
    d3.csv(
        "../data/lab8_embedding_map.csv",
        parseEmbeddingData
    ),

    d3.csv(
        "../data/lab8_topic_section_matrix.csv",
        parseMatrixData
    ),

    d3.json(
        "../data/lab8_corpus_stats.json"
    )
])
.then(
    ([data, matrix, stats]) => {

        allData = data;
        matrixData = matrix;
        corpusStats = stats;

        initializeScales();

        initializeFilters();

        drawAxes();

        drawPoints();

        drawTopicLegend();

        drawCorpusOverview();

        drawSectionSummary();

        drawMatrix();

        setupSearch();

        setupReset();

        updateDetails();

        updatePointVisibility();
    }
)
.catch(
    error => {
        console.error(
            "Error loading Lab 8 data:",
            error
        );

        showError(
            "Unable to load the Lab 8 data. " +
            "Check that all required files exist " +
            "inside the data folder."
        );
    }
);


function parseEmbeddingData(d) {
    return {
        ...d,
        x: +d.x,
        y: +d.y,
        page: +d.page,
        word_count: +d.word_count,
        cluster: +d.cluster
    };
}


function parseMatrixData(d) {
    return {
        ...d,
        count: +d.count,
        proportion: +d.proportion,
        section_total: +d.section_total
    };
}


function initializeScales() {
    xScale = d3.scaleLinear()
        .domain(
            d3.extent(
                allData,
                d => d.x
            )
        )
        .nice()
        .range([
            0,
            chartWidth
        ]);

    yScale = d3.scaleLinear()
        .domain(
            d3.extent(
                allData,
                d => d.y
            )
        )
        .nice()
        .range([
            chartHeight,
            0
        ]);

    radiusScale = d3.scaleSqrt()
        .domain([
            0,
            d3.max(
                allData,
                d => d.word_count
            )
        ])
        .range([
            3,
            10
        ]);

    const topics = [
        ...new Set(
            allData.map(
                d => d.cluster_name
            )
        )
    ].sort();

    colorScale.domain(
        topics
    );
}


function initializeFilters() {
    const sections = [
        ...new Set(
            allData.map(
                d => d.section
            )
        )
    ].sort();

    const topics = [
        ...new Set(
            allData.map(
                d => d.cluster_name
            )
        )
    ].sort();

    sectionFilter
        .selectAll(
            ".section-option"
        )
        .data(sections)
        .join("option")
        .attr(
            "class",
            "section-option"
        )
        .attr(
            "value",
            d => d
        )
        .text(
            d => d
        );

    topicFilter
        .selectAll(
            ".topic-option"
        )
        .data(topics)
        .join("option")
        .attr(
            "class",
            "topic-option"
        )
        .attr(
            "value",
            d => d
        )
        .text(
            d => d
        );

    sectionFilter.on(
        "change",
        applyFilters
    );

    topicFilter.on(
        "change",
        applyFilters
    );
}


function drawAxes() {
    xAxisGroup.call(
        d3.axisBottom(
            xScale
        )
        .ticks(8)
        .tickSizeOuter(0)
    );

    yAxisGroup.call(
        d3.axisLeft(
            yScale
        )
        .ticks(8)
        .tickSizeOuter(0)
    );
}


function drawPoints() {
    points = plot
        .selectAll(
            ".passage-point"
        )
        .data(
            allData,
            d => d.passage_id
        )
        .join("circle")
        .attr(
            "class",
            "passage-point"
        )
        .attr(
            "cx",
            d => xScale(d.x)
        )
        .attr(
            "cy",
            d => yScale(d.y)
        )
        .attr(
            "r",
            d => radiusScale(
                d.word_count
            )
        )
        .attr(
            "fill",
            d => colorScale(
                d.cluster_name
            )
        )
        .attr(
            "stroke",
            "#ffffff"
        )
        .attr(
            "stroke-width",
            0.8
        )
        .attr(
            "opacity",
            0.78
        )
        .style(
            "cursor",
            "pointer"
        )
        .on(
            "mouseenter",
            showTooltip
        )
        .on(
            "mousemove",
            moveTooltip
        )
        .on(
            "mouseleave",
            hideTooltip
        )
        .on(
            "click",
            handlePointClick
        );
}


function drawTopicLegend() {
    const legend = d3.select(
        "#topic-legend"
    );

    const topics = colorScale
        .domain();

    legend
        .selectAll(
            ".topic-legend-item"
        )
        .data(topics)
        .join("div")
        .attr(
            "class",
            "topic-legend-item"
        )
        .html(
            d => `
                <span
                    class="topic-legend-box"
                    style="
                        background:
                        ${colorScale(d)};
                    ">
                </span>
                <span>
                    ${escapeHTML(d)}
                </span>
            `
        );
}


function drawCorpusOverview() {
    d3.select("#raw-count")
        .text(
            d3.format(",")(
                corpusStats.raw_count
            )
        );

    d3.select("#clean-count")
        .text(
            d3.format(",")(
                corpusStats.clean_count
            )
        );

    d3.select("#average-length")
        .text(
            `${corpusStats.average_word_count} words`
        );

    d3.select("#section-count")
        .text(
            corpusStats.section_count
        );
}


function drawSectionSummary() {
    const summary = d3.rollups(
        allData,
        values => values.length,
        d => d.section
    )
    .sort(
        (a, b) => d3.descending(
            a[1],
            b[1]
        )
    );

    const container = d3.select(
        "#section-summary"
    );

    const maxValue = d3.max(
        summary,
        d => d[1]
    );

    const rows = container
        .selectAll(
            ".section-summary-row"
        )
        .data(summary)
        .join("div")
        .attr(
            "class",
            "section-summary-row"
        );

    rows.html("");

    rows
        .append("span")
        .attr(
            "class",
            "section-summary-label"
        )
        .text(
            d => d[0]
        );

    const bar = rows
        .append("div")
        .attr(
            "class",
            "section-summary-bar"
        );

    bar
        .append("span")
        .attr(
            "class",
            "section-summary-fill"
        )
        .style(
            "width",
            d =>
                `${100 * d[1] / maxValue}%`
        );

    rows
        .append("span")
        .attr(
            "class",
            "section-summary-value"
        )
        .text(
            d =>
                d3.format(",")(
                    d[1]
                )
        );
}

function updatePointVisibility() {
    applyFilters();
}

function applyFilters() {
    const section =
        sectionFilter.property(
            "value"
        );

    const topic =
        topicFilter.property(
            "value"
        );

    const query =
        searchInput
            .property("value")
            .toLowerCase()
            .trim();

    const filtered = allData.filter(
        d => {

            const sectionMatch =
                section === "all"
                ||
                d.section === section;

            const topicMatch =
                topic === "all"
                ||
                d.cluster_name === topic;

            const searchMatch =
                query === ""
                ||
                (d.text || "")
                    .toLowerCase()
                    .includes(query)
                ||
                d.section
                    .toLowerCase()
                    .includes(query)
                ||
                d.chapter
                    .toLowerCase()
                    .includes(query)
                ||
                d.subsection
                    .toLowerCase()
                    .includes(query);

            return (
                sectionMatch &&
                topicMatch &&
                searchMatch
            );
        }
    );

    const visibleIds = new Set(
        filtered.map(
            d => d.passage_id
        )
    );

    points
        .transition()
        .duration(180)
        .attr(
            "opacity",
            d => {

                if (
                    !visibleIds.has(
                        d.passage_id
                    )
                ) {
                    return 0.08;
                }

                return getPointOpacity(
                    d
                );
            }
        );

    updatePointStyles();
}


function getPointOpacity(d) {
    if (
        selectedPoint &&
        d.passage_id ===
        selectedPoint.passage_id
    ) {
        return 1;
    }

    if (
        selectedNeighbors.some(
            n =>
                n.passage_id ===
                d.passage_id
        )
    ) {
        return 1;
    }

    if (
        selectedMatrixCell &&
        d.section ===
        selectedMatrixCell.section &&
        d.cluster_name ===
        selectedMatrixCell.cluster_name
    ) {
        return 1;
    }

    return 0.78;
}


function updatePointStyles() {
    points
        .attr(
            "stroke",
            d => {

                if (
                    selectedPoint &&
                    d.passage_id ===
                    selectedPoint.passage_id
                ) {
                    return "#111111";
                }

                if (
                    selectedNeighbors.some(
                        n =>
                            n.passage_id ===
                            d.passage_id
                    )
                ) {
                    return "#222222";
                }

                if (
                    selectedMatrixCell &&
                    d.section ===
                    selectedMatrixCell.section &&
                    d.cluster_name ===
                    selectedMatrixCell.cluster_name
                ) {
                    return "#111111";
                }

                return "#ffffff";
            }
        )
        .attr(
            "stroke-width",
            d => {

                if (
                    selectedPoint &&
                    d.passage_id ===
                    selectedPoint.passage_id
                ) {
                    return 3;
                }

                if (
                    selectedNeighbors.some(
                        n =>
                            n.passage_id ===
                            d.passage_id
                    )
                ) {
                    return 2;
                }

                if (
                    selectedMatrixCell &&
                    d.section ===
                    selectedMatrixCell.section &&
                    d.cluster_name ===
                    selectedMatrixCell.cluster_name
                ) {
                    return 2;
                }

                return 0.8;
            }
        );
}


function setupSearch() {
    searchInput.on(
        "input",
        () => {

            selectedMatrixCell = null;

            updateMatrixStyles();

            applyFilters();
        }
    );
}


function setupReset() {
    resetButton.on(
        "click",
        resetVisualization
    );
}


function resetVisualization() {
    searchInput.property(
        "value",
        ""
    );

    sectionFilter.property(
        "value",
        "all"
    );

    topicFilter.property(
        "value",
        "all"
    );

    selectedPoint = null;
    selectedNeighbors = [];
    selectedMatrixCell = null;

    svg.transition()
        .duration(500)
        .call(
            zoom.transform,
            d3.zoomIdentity
        );

    updateDetails();

    updateMatrixStyles();

    applyFilters();
}


function handlePointClick(event, d) {
    event.stopPropagation();

    selectedPoint = d;

    selectedNeighbors =
        findNearestNeighbors(
            d
        );

    selectedMatrixCell = {
        section: d.section,
        cluster_name: d.cluster_name
    };

    updateDetails();

    updateMatrixStyles();

    applyFilters();
}


function findNearestNeighbors(d) {
    if (
        !d.neighbor_ids
    ) {
        return [];
    }

    const ids =
        d.neighbor_ids
            .split("|")
            .filter(
                id => id !== ""
            );

    const scores =
        d.neighbor_scores
            ? d.neighbor_scores
                .split("|")
                .map(Number)
            : [];

    return ids
        .map(
            (id, index) => {

                const passage =
                    allData.find(
                        item =>
                            item.passage_id ===
                            id
                    );

                if (!passage) {
                    return null;
                }

                return {
                    ...passage,
                    similarity:
                        scores[index]
                };
            }
        )
        .filter(
            d => d !== null
        );
}


function updateDetails() {
    if (!selectedPoint) {
        detailPanel.html(
            `
            <h3>Passage Details</h3>

            <p>
                Select a passage on the map to explore
                its document structure, semantic topic,
                original passage, and nearest semantic
                passages.
            </p>
            `
        );

        return;
    }

    const neighborHTML =
        selectedNeighbors.length > 0
            ? selectedNeighbors
                .map(
                    d => `
                    <li>
                        <strong>
                            ${escapeHTML(
                                d.section
                            )}
                        </strong>
                        — Page ${d.page}
                        <br>
                        Topic:
                        ${escapeHTML(
                            d.cluster_name
                        )}
                        <br>
                        Similarity:
                        ${
                            Number.isFinite(
                                d.similarity
                            )
                                ? d.similarity.toFixed(3)
                                : "—"
                        }
                    </li>
                    `
                )
                .join("")
            : `
                <li>
                    No semantic neighbors available.
                </li>
            `;

    detailPanel.html(
        `
        <div class="detail-header">

            <h3>
                ${escapeHTML(
                    selectedPoint.section
                )}
            </h3>

            <span class="detail-topic">
                ${escapeHTML(
                    selectedPoint.cluster_name
                )}
            </span>

        </div>


        <div class="detail-metadata">

            <p>
                <strong>Passage:</strong>
                ${escapeHTML(
                    selectedPoint.passage_id
                )}
            </p>

            <p>
                <strong>Chapter:</strong>
                ${escapeHTML(
                    selectedPoint.chapter
                )}
            </p>

            <p>
                <strong>Section:</strong>
                ${escapeHTML(
                    selectedPoint.section
                )}
            </p>

            <p>
                <strong>Subsection:</strong>
                ${escapeHTML(
                    selectedPoint.subsection
                )}
            </p>

            <p>
                <strong>Page:</strong>
                ${selectedPoint.page}
            </p>

            <p>
                <strong>Semantic Topic:</strong>
                ${escapeHTML(
                    selectedPoint.cluster_name
                )}
            </p>

            <p>
                <strong>Word Count:</strong>
                ${selectedPoint.word_count}
            </p>

        </div>


        <div class="detail-passage">

            <h4>
                Original Passage
            </h4>

            <p>
                ${escapeHTML(
                    selectedPoint.text
                )}
            </p>

        </div>


        <div class="detail-neighbors">

            <h4>
                5 Nearest Semantic Passages
            </h4>

            <ol>
                ${neighborHTML}
            </ol>

        </div>
        `
    );
}


function drawMatrix() {
    const container = d3.select("#topic-section-matrix");
    container.html("");

    const sections = [...new Set(
        allData.map(d => d.section)
    )].sort();

    const topics = colorScale.domain().slice().sort();

    const matrixLookup = new Map(
        matrixData.map(d => [
            `${d.section}|||${d.cluster_name}`,
            d
        ])
    );

    const values = [];

    sections.forEach(section => {
        topics.forEach(topic => {
            const match = matrixLookup.get(
                `${section}|||${topic}`
            );

            values.push({
                section,
                cluster_name: topic,
                count: match ? match.count : 0,
                proportion: match ? match.proportion : 0,
                section_total: match ? match.section_total : 0
            });
        });
    });

    const labelWidth = 270;
    const columnWidth = 142;
    const rowHeight = 39;
    const headerHeight = 155;
    const rightPadding = 28;
    const bottomPadding = 24;

    const matrixWidth =
        labelWidth + topics.length * columnWidth + rightPadding;

    const matrixHeight =
        headerHeight + sections.length * rowHeight + bottomPadding;

    const maxCount = d3.max(values, d => d.count) || 1;

    const cellColor = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, Math.sqrt(maxCount)]);

    const colorForCount = count =>
        count === 0
            ? "#f1f4f8"
            : cellColor(Math.sqrt(count));

    const matrixSvg = container.append("svg")
        .attr("class", "matrix-svg")
        .attr("width", matrixWidth)
        .attr("height", matrixHeight)
        .attr("viewBox", `0 0 ${matrixWidth} ${matrixHeight}`)
        .attr("role", "img")
        .attr(
            "aria-label",
            "Heatmap showing passage counts by formal section and semantic topic"
        );

    matrixSvg.append("text")
        .attr("class", "matrix-title")
        .attr("x", 22)
        .attr("y", 29)
        .text("Passages across sections and semantic topics");

    matrixSvg.append("text")
        .attr("class", "matrix-subtitle")
        .attr("x", 22)
        .attr("y", 52)
        .text("Select a cell to explore its passages on the semantic map.");

    const legend = matrixSvg.append("g")
        .attr("class", "matrix-legend")
        .attr("transform", "translate(22,76)");

    const gradientId = "lab8-matrix-gradient";

    const gradient = matrixSvg.append("defs")
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

    [0, 0.25, 0.5, 0.75, 1].forEach(t => {
        gradient.append("stop")
            .attr("offset", `${t * 100}%`)
            .attr(
                "stop-color",
                cellColor(Math.sqrt(maxCount) * t)
            );
    });

    legend.append("text")
        .attr("class", "matrix-legend-label")
        .attr("x", 0)
        .attr("y", 12)
        .text("Passage count");

    legend.append("rect")
        .attr("x", 105)
        .attr("y", 0)
        .attr("width", 150)
        .attr("height", 12)
        .attr("rx", 3)
        .attr("fill", `url(#${gradientId})`);

    legend.append("text")
        .attr("class", "matrix-legend-tick")
        .attr("x", 105)
        .attr("y", 27)
        .text("Fewer");

    legend.append("text")
        .attr("class", "matrix-legend-tick")
        .attr("x", 255)
        .attr("y", 27)
        .attr("text-anchor", "end")
        .text("More");

    matrixSvg.append("text")
        .attr("class", "matrix-axis-heading")
        .attr("x", 22)
        .attr("y", headerHeight - 13)
        .text("FORMAL BULLETIN SECTION");

    matrixSvg.append("text")
        .attr("class", "matrix-axis-heading")
        .attr("x", labelWidth)
        .attr("y", headerHeight - 77)
        .text("SEMANTIC TOPIC");

    const wrapTopic = (text, maxChars = 19) => {
        const words = text.split(/\s+/);
        const lines = [];
        let line = "";

        words.forEach(word => {
            const next = line ? `${line} ${word}` : word;

            if (next.length > maxChars && line) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        });

        if (line) lines.push(line);

        return lines;
    };

    const topicLabels = matrixSvg.append("g")
        .attr("class", "matrix-column-labels");

    topics.forEach((topic, i) => {
        const x =
            labelWidth + i * columnWidth + columnWidth / 2;

        const lines = wrapTopic(topic);

        const label = topicLabels.append("text")
            .attr("class", "matrix-column-label")
            .attr("x", x)
            .attr("y", headerHeight - 65)
            .attr("text-anchor", "middle");

        label.append("title").text(topic);

        lines.forEach((line, lineIndex) => {
            label.append("tspan")
                .attr("x", x)
                .attr("dy", lineIndex === 0 ? 0 : 14)
                .text(line);
        });
    });

    const rowLabels = matrixSvg.append("g")
        .attr("class", "matrix-row-labels");

    rowLabels.selectAll("text")
        .data(sections)
        .join("text")
        .attr("class", "matrix-row-label")
        .attr("x", labelWidth - 16)
        .attr(
            "y",
            (_, i) =>
                headerHeight + i * rowHeight + rowHeight / 2 + 4
        )
        .attr("text-anchor", "end")
        .text(d => d)
        .append("title")
        .text(d => d);

    const matrixGroup = matrixSvg.append("g")
        .attr(
            "transform",
            `translate(${labelWidth},${headerHeight})`
        );

    matrixGroup.selectAll(".matrix-cell")
        .data(values)
        .join("rect")
        .attr("class", "matrix-cell")
        .attr("x", d =>
            topics.indexOf(d.cluster_name) * columnWidth + 4
        )
        .attr("y", d =>
            sections.indexOf(d.section) * rowHeight + 4
        )
        .attr("width", columnWidth - 8)
        .attr("height", rowHeight - 8)
        .attr("rx", 5)
        .attr("fill", d => colorForCount(d.count))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseenter", showMatrixTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip)
        .on("click", handleMatrixClick)
        .append("title")
        .text(d =>
            `${d.section} · ${d.cluster_name}: ${d.count} passages`
        );

    matrixGroup.selectAll(".matrix-value")
        .data(values)
        .join("text")
        .attr("class", "matrix-value")
        .attr("x", d =>
            topics.indexOf(d.cluster_name) * columnWidth +
            columnWidth / 2
        )
        .attr("y", d =>
            sections.indexOf(d.section) * rowHeight +
            rowHeight / 2 + 4
        )
        .attr("text-anchor", "middle")
        .attr("fill", d =>
            d.count > maxCount * 0.48
                ? "#ffffff"
                : "#23344d"
        )
        .text(d =>
            d.count === 0 ? "–" : d3.format(",")(d.count)
        )
        .style("pointer-events", "none");

    matrixGroup.selectAll(".matrix-row-guide")
        .data(sections)
        .join("line")
        .attr("class", "matrix-row-guide")
        .attr("x1", 0)
        .attr("x2", topics.length * columnWidth)
        .attr("y1", (_, i) => (i + 1) * rowHeight)
        .attr("y2", (_, i) => (i + 1) * rowHeight)
        .attr("stroke", "#e8edf3")
        .attr("stroke-width", 0.6)
        .lower();

    updateMatrixStyles();
}

function handleMatrixClick(event, d) {
    event.stopPropagation();

    selectedMatrixCell = {
        section: d.section,
        cluster_name: d.cluster_name
    };

    selectedPoint = null;
    selectedNeighbors = [];

    sectionFilter.property(
        "value",
        d.section
    );

    topicFilter.property(
        "value",
        d.cluster_name
    );

    updateDetails();

    updateMatrixStyles();

    applyFilters();

    document
        .querySelector(
            "#semantic-section"
        )
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


function updateMatrixStyles() {
    d3.selectAll(
        ".matrix-cell"
    )
    .attr(
        "stroke",
        d => {

            if (
                selectedMatrixCell &&
                d.section ===
                selectedMatrixCell.section &&
                d.cluster_name ===
                selectedMatrixCell.cluster_name
            ) {
                return "#111111";
            }

            return "#ffffff";
        }
    )
    .attr(
        "stroke-width",
        d => {

            if (
                selectedMatrixCell &&
                d.section ===
                selectedMatrixCell.section &&
                d.cluster_name ===
                selectedMatrixCell.cluster_name
            ) {
                return 3;
            }

            return 1;
        }
    );
}


function showTooltip(event, d) {
    tooltip
        .style(
            "opacity",
            1
        )
        .html(
            `
            <strong>
                ${escapeHTML(
                    d.cluster_name
                )}
            </strong>
            <br>
            ${escapeHTML(
                d.section
            )}
            <br>
            Page ${d.page}
            <br>
            ${d.word_count} words
            `
        );

    moveTooltip(event);
}


function showMatrixTooltip(event, d) {
    tooltip
        .style("opacity", 1)
        .html(`
            <strong>${escapeHTML(d.section)}</strong>
            <div class="matrix-tooltip-topic">
                ${escapeHTML(d.cluster_name)}
            </div>
            <div>Passages: ${d3.format(",")(d.count)}</div>
            <div>Share of section: ${(d.proportion * 100).toFixed(1)}%</div>
        `);

    moveTooltip(event);
}

function moveTooltip(event) {
    tooltip
        .style(
            "left",
            `${event.pageX + 14}px`
        )
        .style(
            "top",
            `${event.pageY + 14}px`
        );
}


function hideTooltip() {
    tooltip
        .style(
            "opacity",
            0
        );
}


function showError(message) {
    mapContainer
        .append("div")
        .attr(
            "class",
            "error-message"
        )
        .text(
            message
        );
}


function escapeHTML(value) {
    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}