(() => {
    const width = 1400;
    const height = 1050;

    const matrixContainer =
        !d3.select("#matrix").empty()
            ? d3.select("#matrix")
            : !d3.select("#adjacency-matrix").empty()
                ? d3.select("#adjacency-matrix")
                : !d3.select("#chart").empty()
                    ? d3.select("#chart")
                    : null;

    if (!matrixContainer) {
        console.error(
            "Adjacency matrix container not found."
        );
        return;
    }

    matrixContainer.selectAll("svg").remove();
    d3.selectAll("#matrix-tooltip").remove();

    const svg = matrixContainer
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto")
        .style("display", "block");

    const add = (parent, element, attrs = {}) => {
        const selection = parent.append(element);

        Object.entries(attrs).forEach(
            ([key, value]) => selection.attr(key, value)
        );

        return selection;
    };

    Promise.all([
        d3.csv(
            "../data/lab5_assignment_stations.csv",
            d => ({
                id: d.id,
                station_name: d.station_name,
                district: d.district,
                daily_passengers: +d.daily_passengers,
                station_type: d.station_type
            })
        ),

        d3.csv(
            "../data/lab5_assignment_routes.csv",
            d => ({
                source: d.source,
                target: d.target,
                travel_time_min: +d.travel_time_min,
                route_type: d.route_type
            })
        )
    ])
        .then(([nodes, links]) => {
            const districts = [
                "West",
                "North",
                "East",
                "Central",
                "South"
            ];

            const stationTypes = [
                "Local",
                "Transfer",
                "Terminal"
            ];

            const districtColorScale = d3.scaleOrdinal()
                .domain(districts)
                .range([
                    "#E45756",
                    "#F28E2B",
                    "#59A14F",
                    "#4E79A7",
                    "#9C6ADE"
                ]);

            const stationTypeOrder = new Map([
                ["Local", 0],
                ["Transfer", 1],
                ["Terminal", 2]
            ]);

            const passengerCategory = value => {
                if (value < 4000) return "Low";
                if (value <= 7000) return "Medium";
                return "High";
            };

            const passengerRadius = {
                Low: 4,
                Medium: 6,
                High: 8
            };

            const travelIntervals = [
                {
                    label: "0–5 min",
                    min: 0,
                    max: 5,
                    opacity: 0.35
                },
                {
                    label: "6–10 min",
                    min: 6,
                    max: 10,
                    opacity: 0.55
                },
                {
                    label: "11–15 min",
                    min: 11,
                    max: 15,
                    opacity: 0.75
                },
                {
                    label: "16–20 min",
                    min: 16,
                    max: 20,
                    opacity: 0.95
                }
            ];

            const getTravelInterval = time =>
                travelIntervals.find(
                    item =>
                        time >= item.min &&
                        time <= item.max
                )?.label ?? `${time} min`;

            const travelOpacity = time =>
                travelIntervals.find(
                    item =>
                        time >= item.min &&
                        time <= item.max
                )?.opacity ?? 0.55;

            const nodeById = new Map(
                nodes.map(d => [d.id, d])
            );

            const connectionMap = new Map();

            links.forEach(link => {
                if (
                    !nodeById.has(link.source) ||
                    !nodeById.has(link.target)
                ) {
                    return;
                }

                const connection = {
                    source: link.source,
                    target: link.target,
                    travel_time_min: link.travel_time_min,
                    route_type: link.route_type
                };

                connectionMap.set(
                    `${link.source}|${link.target}`,
                    connection
                );

                connectionMap.set(
                    `${link.target}|${link.source}`,
                    connection
                );
            });

            const orderedNodes = [...nodes].sort(
                (a, b) => {
                    const districtDifference =
                        districts.indexOf(a.district) -
                        districts.indexOf(b.district);

                    if (districtDifference) {
                        return districtDifference;
                    }

                    const typeDifference =
                        (
                            stationTypeOrder.get(
                                a.station_type
                            ) ?? 99
                        ) -
                        (
                            stationTypeOrder.get(
                                b.station_type
                            ) ?? 99
                        );

                    if (typeDifference) {
                        return typeDifference;
                    }

                    const passengerDifference =
                        b.daily_passengers -
                        a.daily_passengers;

                    if (passengerDifference) {
                        return passengerDifference;
                    }

                    return d3.ascending(a.id, b.id);
                }
            );

            const matrixData = orderedNodes.flatMap(
                rowNode =>
                    orderedNodes.map(colNode => {
                        const connection =
                            rowNode.id === colNode.id
                                ? null
                                : connectionMap.get(
                                    `${rowNode.id}|${colNode.id}`
                                ) ?? null;

                        return {
                            row: rowNode,
                            col: colNode,
                            connected: Boolean(connection),
                            connection
                        };
                    })
            );

            const legendX = 42;
            const legendY = 105;
            const legendWidth = 320;
            const legendHeight = 915;

            const matrixXPosition = 565;
            const matrixYPosition = 245;
            const matrixSize = 700;

            const ids = orderedNodes.map(d => d.id);

            const matrixX = d3.scaleBand()
                .domain(ids)
                .range([0, matrixSize])
                .paddingInner(0.035)
                .paddingOuter(0.005);

            const matrixY = d3.scaleBand()
                .domain(ids)
                .range([0, matrixSize])
                .paddingInner(0.035)
                .paddingOuter(0.005);

            const cellSize = matrixX.bandwidth();

            const chart = add(
                svg,
                "g",
                {
                    class: "matrix-container"
                }
            );

            add(chart, "rect", {
                x: 20,
                y: 16,
                width: width - 40,
                height: height - 32,
                rx: 14,
                fill: "#ffffff",
                stroke: "#d9dfe3",
                "stroke-width": 1
            });

            add(chart, "text", {
                x: 45,
                y: 52,
                "font-size": 28,
                "font-weight": 630,
                "font-family": "Arial, sans-serif",
                fill: "#202124"
            }).text("Adjacency Matrix");

            add(chart, "text", {
                x: 45,
                y: 78,
                "font-size": 15.5,
                "font-family": "Arial, sans-serif",
                fill: "#73777b"
            }).text(
                "Direct station connections grouped by district and station type"
            );

            const legend = add(
                chart,
                "g",
                {
                    class: "matrix-legend",
                    transform:
                        `translate(${legendX},${legendY})`
                }
            );

            add(legend, "rect", {
                x: 0,
                y: 0,
                width: legendWidth,
                height: legendHeight,
                rx: 12,
                fill: "#fafafa",
                stroke: "#d6dce0",
                "stroke-width": 1
            });

            add(legend, "text", {
                x: 22,
                y: 37,
                "font-size": 21,
                "font-weight": 600,
                "font-family": "Arial, sans-serif",
                fill: "#202124"
            }).text("Matrix Encoding");

            add(legend, "line", {
                x1: 22,
                x2: legendWidth - 22,
                y1: 55,
                y2: 55,
                stroke: "#d7dce0"
            });

            const legendHeading = (
                text,
                y
            ) =>
                add(legend, "text", {
                    x: 22,
                    y,
                    "font-size": 14,
                    "font-weight": 600,
                    "font-family": "Arial, sans-serif",
                    fill: "#30343a"
                }).text(text);

            const legendItem = (
                text,
                x,
                y
            ) =>
                add(legend, "text", {
                    x,
                    y,
                    "font-size": 13,
                    "font-family": "Arial, sans-serif",
                    fill: "#4c5359"
                }).text(text);

            legendHeading(
                "Station attributes",
                86
            );

            add(legend, "text", {
                x: 22,
                y: 110,
                "font-size": 13,
                "font-weight": 600,
                fill: "#353a3f"
            }).text(
                "District (label color)"
            );

            districts.forEach(
                (district, i) => {
                    const y = 138 + i * 24;

                    add(legend, "circle", {
                        cx: 29,
                        cy: y - 4,
                        r: 5,
                        fill:
                            districtColorScale(
                                district
                            )
                    });

                    legendItem(
                        district,
                        44,
                        y
                    );
                }
            );

            legendHeading(
                "Station type (marker shape)",
                282
            );

            stationTypes.forEach(
                (type, i) => {
                    const y =
                        312 + i * 28;

                    if (type === "Local") {
                        add(legend, "circle", {
                            cx: 29,
                            cy: y - 4,
                            r: 6,
                            fill: "#ffffff",
                            stroke: "#4f5960",
                            "stroke-width": 1.4
                        });
                    }

                    if (type === "Transfer") {
                        add(legend, "path", {
                            d:
                                `M29 ${y - 11}
                                 L36 ${y - 4}
                                 L29 ${y + 3}
                                 L22 ${y - 4} Z`,
                            fill: "#ffffff",
                            stroke: "#4f5960",
                            "stroke-width": 1.4
                        });
                    }

                    if (type === "Terminal") {
                        add(legend, "rect", {
                            x: 23,
                            y: y - 10,
                            width: 12,
                            height: 12,
                            fill: "#ffffff",
                            stroke: "#4f5960",
                            "stroke-width": 1.4
                        });
                    }

                    legendItem(
                        type,
                        48,
                        y
                    );
                }
            );

            legendHeading(
                "Daily passengers (marker size)",
                410
            );

            [
                {
                    label: "Low (< 4,000)",
                    radius: 4
                },
                {
                    label: "Medium (4,000–7,000)",
                    radius: 6
                },
                {
                    label: "High (> 7,000)",
                    radius: 8
                }
            ].forEach(
                (item, i) => {
                    const y =
                        442 + i * 31;

                    add(legend, "circle", {
                        cx: 30,
                        cy: y - 4,
                        r: item.radius,
                        fill: "#71808a",
                        "fill-opacity": 0.65,
                        stroke: "#53616a",
                        "stroke-width": 0.8
                    });

                    legendItem(
                        item.label,
                        50,
                        y
                    );
                }
            );

            legendHeading(
                "Connection attributes",
                555
            );

            add(legend, "text", {
                x: 22,
                y: 580,
                "font-size": 13,
                "font-weight": 600,
                fill: "#353a3f"
            }).text(
                "Route type (cell pattern)"
            );

            const defs = add(
                svg,
                "defs"
            );

                        const createPattern = (
                id,
                type
            ) => {
                const pattern = add(
                    defs,
                    "pattern",
                    {
                        id,
                        width: 8,
                        height: 8,
                        patternUnits:
                            "userSpaceOnUse"
                    }
                );

                // Express: solid fill
                if (
                    type === "Express"
                ) {
                    add(
                        pattern,
                        "rect",
                        {
                            x: 0,
                            y: 0,
                            width: 8,
                            height: 8,
                            fill: "#26353d"
                        }
                    );
                }

                // Shuttle: keep the existing dot pattern
                if (
                    type === "Shuttle"
                ) {
                    add(
                        pattern,
                        "circle",
                        {
                            cx: 2,
                            cy: 2,
                            r: 1.5,
                            fill: "#26353d"
                        }
                    );

                    add(
                        pattern,
                        "circle",
                        {
                            cx: 6,
                            cy: 6,
                            r: 1.5,
                            fill: "#26353d"
                        }
                    );
                }

                // Metro: single diagonal stripe
                if (
                    type === "Metro"
                ) {
                    add(
                        pattern,
                        "path",
                        {
                            d: "M0,8 L8,0",
                            stroke: "#26353d",
                            "stroke-width": 0.8,
                            fill: "none"
                        }
                    );
                }
            };

            const routePatternNames = [
                "Express",
                "Shuttle",
                "Metro"
            ];

            routePatternNames.forEach(
                (type, i) =>
                    createPattern(
                        `route-pattern-${i}`,
                        type
                    )
            );

            const getRoutePattern = routeType => {
                const normalized =
                    String(routeType)
                        .trim()
                        .toLowerCase();

                if (
                    normalized.includes(
                        "express"
                    )
                ) {
                    return 0;
                }

                if (
                    normalized.includes(
                        "shuttle"
                    )
                ) {
                    return 1;
                }

                if (
                    normalized.includes(
                        "metro"
                    )
                ) {
                    return 2;
                }

                return 0;
            };

            routePatternNames.forEach(
                (type, i) => {
                    const y =
                        610 + i * 29;

                    add(legend, "rect", {
                        x: 22,
                        y: y - 12,
                        width: 22,
                        height: 22,
                        fill:
                            `url(#route-pattern-${i})`,
                        stroke: "#aeb6bb",
                        "stroke-width": 0.7
                    });

                    legendItem(
                        type,
                        56,
                        y + 4
                    );
                }
            );

            legendHeading(
                "Travel time (cell opacity)",
                710
            );

            travelIntervals.forEach(
                (item, i) => {
                    const y =
                        740 + i * 27;

                    add(legend, "rect", {
                        x: 22,
                        y: y - 12,
                        width: 24,
                        height: 21,
                        fill: "#526f82",
                        "fill-opacity":
                            item.opacity,
                        stroke: "#aeb6bb",
                        "stroke-width": 0.5
                    });

                    legendItem(
                        item.label,
                        58,
                        y + 4
                    );
                }
            );

            legendHeading(
                "Ordering",
                860
            );

            add(legend, "text", {
                x: 22,
                y: 880,
                "font-size": 13,
                fill: "#4c5359"
            }).text(
                "District → station type → passenger volume"
            );

            add(chart, "text", {
                x:
                    matrixXPosition +
                    matrixSize / 2,
                y: 140,
                "text-anchor": "middle",
                "font-size": 17,
                "font-weight": 700,
                "font-family": "Arial, sans-serif",
                fill: "#4d555b"
            }).text("Target station");

            add(chart, "line", {
                x1: matrixXPosition,
                x2:
                    matrixXPosition +
                    matrixSize,
                y1: matrixYPosition - 34,
                y2: matrixYPosition - 34,
                stroke: "#e1e5e8",
                "stroke-width": 1
            });

            add(chart, "text", {
                x: 485,
                y:
                    550,
                "text-anchor": "middle",
                "font-size": 17,
                "font-weight": 700,
                "font-family": "Arial, sans-serif",
                fill: "#4d555b",
                transform:
                    `rotate(-90,485,${
                        matrixYPosition +
                        matrixSize / 2
                    })`
            }).text("Source station");

            const matrixGroup = add(
                chart,
                "g",
                {
                    class: "matrix-group",
                    transform:
                        `translate(
                            ${matrixXPosition},
                            ${matrixYPosition}
                        )`
                }
            );

            add(matrixGroup, "rect", {
                x: 0,
                y: 0,
                width: matrixSize,
                height: matrixSize,
                fill: "#fbfcfd",
                stroke: "#aeb8be",
                "stroke-width": 1.4
            });

            const cellInset =
                Math.max(
                    1.4,
                    cellSize * 0.12
                );

            const glyphSize =
                Math.max(
                    4,
                    cellSize -
                    cellInset * 2
                );

            const glyphOffset =
                (cellSize -
                    glyphSize) / 2;

            const cells = matrixGroup
                .append("g")
                .attr(
                    "class",
                    "matrix-cells"
                )
                .selectAll("rect")
                .data(matrixData)
                .join("rect")
                .attr(
                    "class",
                    "matrix-cell"
                )
                .attr(
                    "x",
                    d =>
                        matrixX(d.col.id) +
                        glyphOffset
                )
                .attr(
                    "y",
                    d =>
                        matrixY(d.row.id) +
                        glyphOffset
                )
                .attr(
                    "width",
                    glyphSize
                )
                .attr(
                    "height",
                    glyphSize
                )
                .attr(
                    "rx",
                    2
                )
                .attr(
                    "fill",
                    d => {
                        if (
                            !d.connected
                        ) {
                            return "#f3fafc";
                        }

                        return `url(#route-pattern-${
                            getRoutePattern(
                                d.connection
                                    .route_type
                            )
                        })`;
                    }
                )
                .attr(
                    "fill-opacity",
                    d =>
                        d.connected
                            ? travelOpacity(
                                d.connection
                                    .travel_time_min
                            )
                            : 0.001
                )
                .attr(
                    "stroke",
                    d =>
                        d.connected
                            ? "#c5cdd1"
                            : "#e6eaec"
                )
                .attr(
                    "stroke-width",
                    d =>
                        d.connected
                            ? 0.65
                            : 0.35
                )
                .style(
                    "cursor",
                    "pointer"
                );

            const boundaries = [];

            for (
                let i = 1;
                i < orderedNodes.length;
                i++
            ) {
                if (
                    orderedNodes[i]
                        .district !==
                    orderedNodes[i - 1]
                        .district
                ) {
                    boundaries.push(i);
                }
            }

            boundaries.forEach(i => {
                const x =
                    matrixX(
                        orderedNodes[i].id
                    ) -
                    matrixX.step() * 0.02;

                const y =
                    matrixY(
                        orderedNodes[i].id
                    ) -
                    matrixY.step() * 0.02;

                add(matrixGroup, "line", {
                    x1: x,
                    x2: x,
                    y1: 0,
                    y2: matrixSize,
                    stroke: "#c7ced2",
                    "stroke-width": 1.1
                });

                add(matrixGroup, "line", {
                    x1: 0,
                    x2: matrixSize,
                    y1: y,
                    y2: y,
                    stroke: "#c7ced2",
                    "stroke-width": 1.1
                });
            });

            const hoverRow = add(
                matrixGroup,
                "rect",
                {
                    x: 0,
                    width: matrixSize,
                    fill: "#617a88",
                    "fill-opacity": 0,
                    "pointer-events": "none"
                }
            );

            const hoverColumn = add(
                matrixGroup,
                "rect",
                {
                    y: 0,
                    height: matrixSize,
                    fill: "#617a88",
                    "fill-opacity": 0,
                    "pointer-events": "none"
                }
            );

            const hoverRowLine = add(
                matrixGroup,
                "line",
                {
                    x1: 0,
                    x2: matrixSize,
                    stroke: "#34454f",
                    "stroke-width": 1.4,
                    "stroke-opacity": 0,
                    "pointer-events": "none"
                }
            );

            const hoverColumnLine = add(
                matrixGroup,
                "line",
                {
                    y1: 0,
                    y2: matrixSize,
                    stroke: "#34454f",
                    "stroke-width": 1.4,
                    "stroke-opacity": 0,
                    "pointer-events": "none"
                }
            );

            const selectedCell = add(
                matrixGroup,
                "rect",
                {
                    fill: "none",
                    stroke: "#172127",
                    "stroke-width": 2.3,
                    opacity: 0,
                    "pointer-events": "none"
                }
            );

            const rowLabels = add(
                chart,
                "g",
                {
                    class: "row-labels",
                    transform:
                        `translate(
                            ${matrixXPosition - 42},
                            ${matrixYPosition}
                        )`
                }
            );

            const columnLabels = add(
                chart,
                "g",
                {
                    class: "column-labels",
                    transform:
                        `translate(
                            ${matrixXPosition},
                            ${matrixYPosition}
                        )`
                }
            );

            const stationLabel = d =>
                `Station ${String(d.id).replace(
                    /^s/i,
                    ""
                )}`;

            const drawStationMarker = (
                group,
                d,
                x = 0,
                y = 0
            ) => {
                const color =
                    districtColorScale(
                        d.district
                    );

                const volume =
                    passengerCategory(
                        d.daily_passengers
                    );

                const radius =
                    passengerRadius[
                        volume
                    ];

                if (
                    d.station_type ===
                    "Local"
                ) {
                    add(
                        group,
                        "circle",
                        {
                            class:
                                "station-marker",
                            cx: x,
                            cy: y,
                            r: radius,
                            fill: color,
                            "fill-opacity":
                                0.95,
                            stroke:
                                "#ffffff",
                            "stroke-width": 1
                        }
                    );
                }

                if (
                    d.station_type ===
                    "Transfer"
                ) {
                    add(
                        group,
                        "path",
                        {
                            class:
                                "station-marker",
                            d:
                                `M${x} ${
                                    y - radius
                                }
                                 L${
                                    x + radius
                                } ${y}
                                 L${x} ${
                                    y + radius
                                }
                                 L${
                                    x - radius
                                } ${y} Z`,
                            fill: color,
                            "fill-opacity":
                                0.95,
                            stroke:
                                "#ffffff",
                            "stroke-width": 1
                        }
                    );
                }

                if (
                    d.station_type ===
                    "Terminal"
                ) {
                    add(
                        group,
                        "rect",
                        {
                            class:
                                "station-marker",
                            x:
                                x - radius,
                            y:
                                y - radius,
                            width:
                                radius * 2,
                            height:
                                radius * 2,
                            fill: color,
                            "fill-opacity":
                                0.95,
                            stroke:
                                "#ffffff",
                            "stroke-width": 1
                        }
                    );
                }
            };

            const rowLabelGroups =
                rowLabels
                    .selectAll("g")
                    .data(orderedNodes)
                    .join("g")
                    .attr(
                        "transform",
                        d =>
                            `translate(
                                0,
                                ${
                                    matrixY(
                                        d.id
                                    ) +
                                    cellSize / 2
                                }
                            )`
                    )
                    .style(
                        "cursor",
                        "pointer"
                    );

            rowLabelGroups.each(
                function(d) {
                    const group =
                        d3.select(this);

                    drawStationMarker(
                        group,
                        d,
                        13,
                        0
                    );

                    group
                        .append("text")
                        .attr(
                            "class",
                            "station-id"
                        )
                        .attr(
                            "x",
                            -2
                        )
                        .attr(
                            "y",
                            4
                        )
                        .attr(
                            "text-anchor",
                            "end"
                        )
                        .attr(
                            "font-size",
                            11.5
                        )
                        .attr(
                            "font-weight",
                            600
                        )
                        .attr(
                            "font-family",
                            "Arial, sans-serif"
                        )
                        .attr(
                            "fill",
                            districtColorScale(
                                d.district
                            )
                        )
                        .text(
                            stationLabel(d)
                        );
                }
            );

            const columnLabelGroups =
                columnLabels
                    .selectAll("g")
                    .data(orderedNodes)
                    .join("g")
                    .attr(
                        "transform",
                        d =>
                            `translate(
                                ${
                                    matrixX(
                                        d.id
                                    ) +
                                    cellSize / 2
                                },
                                0
                            )`
                    )
                    .style(
                        "cursor",
                        "pointer"
                    );

            columnLabelGroups.each(
                function(d) {
                    const group =
                        d3.select(this);

                    drawStationMarker(
                        group,
                        d,
                        0,
                        -20
                    );

                    group
                        .append("text")
                        .attr(
                            "class",
                            "station-id"
                        )
                        .attr(
                            "x",
                            20
                        )
                        .attr(
                            "y",
                            -8
                        )
                        .attr(
                            "text-anchor",
                            "start"
                        )
                        .attr(
                            "transform",
                            "rotate(-62, -10, -8)"
                        )
                        .attr(
                            "font-size",
                            12
                        )
                        .attr(
                            "font-weight",
                            600
                        )
                        .attr(
                            "font-family",
                            "Arial, sans-serif"
                        )
                        .attr(
                            "fill",
                            districtColorScale(
                                d.district
                            )
                        )
                        .text(
                            `Station ${String(d.id).replace(
                                /^s/i,
                                ""
                            )}`
                        );
                }
            );

            let tooltip =
                d3.select(
                    "#matrix-tooltip"
                );

            if (tooltip.empty()) {
                tooltip =
                    d3.select("body")
                        .append("div")
                        .attr(
                            "id",
                            "matrix-tooltip"
                        )
                        .style(
                            "position",
                            "fixed"
                        )
                        .style(
                            "display",
                            "none"
                        )
                        .style(
                            "pointer-events",
                            "none"
                        )
                        .style(
                            "background",
                            "#ffffff"
                        )
                        .style(
                            "border",
                            "1px solid #d5dce0"
                        )
                        .style(
                            "border-radius",
                            "9px"
                        )
                        .style(
                            "padding",
                            "14px 16px"
                        )
                        .style(
                            "font-family",
                            "Arial, sans-serif"
                        )
                        .style(
                            "font-size",
                            "13px"
                        )
                        .style(
                            "line-height",
                            "1.5"
                        )
                        .style(
                            "box-shadow",
                            "0 5px 18px rgba(0,0,0,0.14)"
                        )
                        .style(
                            "z-index",
                            10000
                        )
                        .style(
                            "min-width",
                            "230px"
                        )
                        .style(
                            "max-width",
                            "310px"
                        );
            }

            const moveTooltip = event => {
                const node =
                    tooltip.node();

                if (!node) return;

                const rect =
                    node.getBoundingClientRect();

                let left =
                    event.clientX + 16;

                let top =
                    event.clientY + 16;

                if (
                    left + rect.width >
                    window.innerWidth - 12
                ) {
                    left =
                        event.clientX -
                        rect.width -
                        16;
                }

                if (
                    top + rect.height >
                    window.innerHeight - 12
                ) {
                    top =
                        event.clientY -
                        rect.height -
                        16;
                }

                tooltip
                    .style(
                        "left",
                        `${Math.max(
                            12,
                            left
                        )}px`
                    )
                    .style(
                        "top",
                        `${Math.max(
                            12,
                            top
                        )}px`
                    );
            };

            const showTooltip = (
                event,
                html
            ) => {
                tooltip
                    .style(
                        "display",
                        "block"
                    )
                    .style(
                        "opacity",
                        0
                    )
                    .html(html)
                    .transition()
                    .duration(100)
                    .style(
                        "opacity",
                        1
                    );

                moveTooltip(event);
            };

            const hideTooltip = () => {
                tooltip
                    .interrupt()
                    .transition()
                    .duration(80)
                    .style(
                        "opacity",
                        0
                    )
                    .on(
                        "end",
                        () =>
                            tooltip.style(
                                "display",
                                "none"
                            )
                    );
            };

            const baseCellOpacity = d =>
                d.connected
                    ? travelOpacity(
                        d.connection
                            .travel_time_min
                    )
                    : 0.001;

            const resetHighlight = () => {
                cells
                    .interrupt()
                    .transition()
                    .duration(120)
                    .attr(
                        "fill-opacity",
                        baseCellOpacity
                    )
                    .attr(
                        "stroke",
                        d =>
                            d.connected
                                ? "#c5cdd1"
                                : "#e6eaec"
                    )
                    .attr(
                        "stroke-width",
                        d =>
                            d.connected
                                ? 0.65
                                : 0.35
                    );

                rowLabelGroups
                    .transition()
                    .duration(100)
                    .attr(
                        "opacity",
                        1
                    );

                columnLabelGroups
                    .transition()
                    .duration(100)
                    .attr(
                        "opacity",
                        1
                    );

                hoverRow
                    .attr(
                        "fill-opacity",
                        0
                    );

                hoverColumn
                    .attr(
                        "fill-opacity",
                        0
                    );

                hoverRowLine
                    .attr(
                        "stroke-opacity",
                        0
                    );

                hoverColumnLine
                    .attr(
                        "stroke-opacity",
                        0
                    );

                selectedCell
                    .attr(
                        "opacity",
                        0
                    );
            };

            const highlightStation = id => {
                cells
                    .interrupt()
                    .transition()
                    .duration(120)
                    .attr(
                        "fill-opacity",
                        d => {
                            if (
                                !d.connected
                            ) {
                                return 0.001;
                            }

                            const selected =
                                d.row.id === id ||
                                d.col.id === id;

                            return selected
                                ? Math.max(
                                    0.95,
                                    baseCellOpacity(
                                        d
                                    )
                                )
                                : 0.035;
                        }
                    )
                    .attr(
                        "stroke",
                        d =>
                            d.row.id === id ||
                            d.col.id === id
                                ? "#26343d"
                                : "#e6eaec"
                    )
                    .attr(
                        "stroke-width",
                        d =>
                            d.row.id === id ||
                            d.col.id === id
                                ? 1.4
                                : 0.35
                    );

                rowLabelGroups
                    .transition()
                    .duration(100)
                    .attr(
                        "opacity",
                        d =>
                            d.id === id
                                ? 1
                                : 0.28
                    );

                columnLabelGroups
                    .transition()
                    .duration(100)
                    .attr(
                        "opacity",
                        d =>
                            d.id === id
                                ? 1
                                : 0.28
                    );

                hoverRow
                    .attr(
                        "y",
                        matrixY(id)
                    )
                    .attr(
                        "height",
                        cellSize
                    )
                    .attr(
                        "fill-opacity",
                        0.035
                    );

                hoverColumn
                    .attr(
                        "x",
                        matrixX(id)
                    )
                    .attr(
                        "width",
                        cellSize
                    )
                    .attr(
                        "fill-opacity",
                        0.035
                    );

                hoverRowLine
                    .attr(
                        "y1",
                        matrixY(id) +
                        cellSize / 2
                    )
                    .attr(
                        "y2",
                        matrixY(id) +
                        cellSize / 2
                    )
                    .attr(
                        "stroke-opacity",
                        0.55
                    );

                hoverColumnLine
                    .attr(
                        "x1",
                        matrixX(id) +
                        cellSize / 2
                    )
                    .attr(
                        "x2",
                        matrixX(id) +
                        cellSize / 2
                    )
                    .attr(
                        "stroke-opacity",
                        0.55
                    );
            };

            const highlightCell = d => {
                const sourceId =
                    d.row.id;

                const targetId =
                    d.col.id;

                cells
                    .interrupt()
                    .transition()
                    .duration(120)
                    .attr(
                        "fill-opacity",
                        baseCellOpacity
                    )
                    .attr(
                        "stroke",
                        cell =>
                            cell.connected
                                ? "#c5cdd1"
                                : "#e6eaec"
                    )
                    .attr(
                        "stroke-width",
                        cell =>
                            cell.connected
                                ? 0.65
                                : 0.35
                    );

                // Highlight source station
                rowLabelGroups
                    .transition()
                    .duration(100)
                    .attr(
                        "opacity",
                        station =>
                            station.id === sourceId
                                ? 1
                                : 0.28
                    );

                // Highlight target station
                columnLabelGroups
                    .transition()
                    .duration(100)
                    .attr(
                        "opacity",
                        station =>
                            station.id === targetId
                                ? 1
                                : 0.28
                    );

                hoverRow
                    .attr(
                        "y",
                        matrixY(sourceId)
                    )
                    .attr(
                        "height",
                        cellSize
                    )
                    .attr(
                        "fill",
                        "#dceff5"
                    )
                    .attr(
                        "fill-opacity",
                        0.18
                    );

                hoverColumn
                    .attr(
                        "x",
                        matrixX(targetId)
                    )
                    .attr(
                        "width",
                        cellSize
                    )
                    .attr(
                        "fill",
                        "#dceff5"
                    )
                    .attr(
                        "fill-opacity",
                        0.18
                    );

                // Horizontal crosshair
                hoverRowLine
                    .attr(
                        "y1",
                        matrixY(sourceId) +
                            cellSize / 2
                    )
                    .attr(
                        "y2",
                        matrixY(sourceId) +
                            cellSize / 2
                    )
                    .attr(
                        "stroke",
                        "#26353d"
                    )
                    .attr(
                        "stroke-opacity",
                        0.7
                    );

                // Vertical crosshair
                hoverColumnLine
                    .attr(
                        "x1",
                        matrixX(targetId) +
                            cellSize / 2
                    )
                    .attr(
                        "x2",
                        matrixX(targetId) +
                            cellSize / 2
                    )
                    .attr(
                        "stroke",
                        "#26353d"
                    )
                    .attr(
                        "stroke-opacity",
                        0.7
                    );

                
                hoverRow.raise();
                hoverColumn.raise();
                hoverRowLine.raise();
                hoverColumnLine.raise();

                selectedCell
                    .attr(
                        "opacity",
                        0
                    );
            };

            const stationTooltip = d => `
                <div style="
                    font-size:15px;
                    font-weight:600;
                    margin-bottom:8px;
                ">
                    ${stationLabel(d)}
                </div>

                <div>
                    <strong>District:</strong>
                    ${d.district}
                </div>

                <div>
                    <strong>Station Type:</strong>
                    ${d.station_type}
                </div>

                <div>
                    <strong>Daily Passengers:</strong>
                    ${d.daily_passengers.toLocaleString()}
                </div>

                <div>
                    <strong>Passenger Volume:</strong>
                    ${passengerCategory(
                        d.daily_passengers
                    )}
                </div>
            `;

            const cellTooltip = d => {
                if (!d.connected) {
                    return `
                        <div style="
                            font-size:15px;
                            font-weight:600;
                            margin-bottom:7px;
                        ">
                            No direct connection
                        </div>

                        <div>
                            ${stationLabel(d.row)}
                            ↔
                            ${stationLabel(d.col)}
                        </div>
                    `;
                }

                const source =
                    nodeById.get(
                        d.connection.source
                    );

                const target =
                    nodeById.get(
                        d.connection.target
                    );

                return `
                    <div style="
                        font-size:15px;
                        font-weight:600;
                        margin-bottom:8px;
                    ">
                        ${stationLabel(source)}
                        ↔
                        ${stationLabel(target)}
                    </div>

                    <div>
                        <strong>Source:</strong>
                        ${stationLabel(source)}
                    </div>

                    <div>
                        <strong>District:</strong>
                        ${source.district}
                    </div>

                    <div>
                        <strong>Station Type:</strong>
                        ${source.station_type}
                    </div>

                    <div style="
                        margin-top:8px;
                    ">
                        <strong>Target:</strong>
                        ${stationLabel(target)}
                    </div>

                    <div>
                        <strong>District:</strong>
                        ${target.district}
                    </div>

                    <div>
                        <strong>Station Type:</strong>
                        ${target.station_type}
                    </div>

                    <hr style="
                        border:0;
                        border-top:1px solid #e0e4e7;
                        margin:9px 0;
                    ">

                    <div>
                        <strong>Route Type:</strong>
                        ${d.connection.route_type}
                    </div>

                    <div>
                        <strong>Travel Time:</strong>
                        ${d.connection.travel_time_min}
                        min
                    </div>

                    <div>
                        <strong>Interval:</strong>
                        ${getTravelInterval(
                            d.connection
                                .travel_time_min
                        )}
                    </div>
                `;
            };

            cells
                .on(
                    "mouseover",
                    function(event, d) {
                        highlightCell(d);

                        showTooltip(
                            event,
                            cellTooltip(d)
                        );
                    }
                )
                .on(
                    "mousemove",
                    moveTooltip
                )
                .on(
                    "mouseout",
                    function() {
                        resetHighlight();
                        hideTooltip();
                    }
                );

            rowLabelGroups
                .on(
                    "mouseover",
                    function(event, d) {
                        highlightStation(
                            d.id
                        );

                        showTooltip(
                            event,
                            stationTooltip(d)
                        );
                    }
                )
                .on(
                    "mousemove",
                    moveTooltip
                )
                .on(
                    "mouseout",
                    function() {
                        resetHighlight();
                        hideTooltip();
                    }
                );

            columnLabelGroups
                .on(
                    "mouseover",
                    function(event, d) {
                        highlightStation(
                            d.id
                        );

                        showTooltip(
                            event,
                            stationTooltip(d)
                        );
                    }
                )
                .on(
                    "mousemove",
                    moveTooltip
                )
                .on(
                    "mouseout",
                    function() {
                        resetHighlight();
                        hideTooltip();
                    }
                );

            add(chart, "text", {
                x:
                    matrixXPosition +
                    matrixSize,
                y:
                    matrixYPosition +
                    matrixSize +
                    30,
                "text-anchor": "end",
                "font-size": 11,
                "font-family": "Arial, sans-serif",
                fill: "#70767a"
            }).text(
                "Hover over a cell or station label to inspect connections"
            );
        })
        .catch(error => {
            console.error(
                "Error loading the adjacency matrix data:",
                error
            );
        });
})();