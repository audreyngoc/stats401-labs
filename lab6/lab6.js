d3.json("../data/lab6_assignment_gdp.json")
    .then(function(data) {

        /* Define GDP status colors */

        const statusColor = d3.scaleOrdinal()
            .domain([
                "Increase",
                "Unchanged",
                "Decrease"
            ])
            .range([
                "#4C9A4C",
                "#BDBDBD",
                "#C44E52"
            ]);


        /* Update the main visualization title */

        d3.selectAll("h2")
            .filter(function() {
                return this.textContent.trim() ===
                    "Treemap Visualizations";
            })
            .text("Hierarchical GDP Treemaps");


        /* Hide the original standalone legend */

        d3.selectAll("h2, h3, h4")
            .filter(function() {
                return this.textContent.trim() ===
                    "GDP Status Legend";
            })
            .style("display", "none")
            .each(function() {

                const nextElement =
                    this.nextElementSibling;

                if (nextElement) {
                    nextElement.style.display = "none";
                }
            });


        /* Update the method descriptions */

        d3.selectAll(".visualization-note")
            .each(function() {

                const text =
                    this.textContent.toLowerCase();

                if (text.includes("squarify")) {

                    this.textContent =
                        "Squarify creates relatively compact " +
                        "rectangles, making differences in " +
                        "country GDP area easier to compare.";
                }

                else if (text.includes("binary")) {

                    this.textContent =
                        "Binary recursively divides available " +
                        "space into two groups, emphasizing " +
                        "hierarchical partitioning while providing " +
                        "a contrast to the Squarify layout.";
                }
            });


        /* Return the continent for a country */

        function getContinent(d) {

            let current = d;

            while (
                current.parent &&
                current.parent.depth > 0
            ) {
                current = current.parent;
            }

            return current.data.name;
        }


        /* Return the Area for a country */

        function getArea(d) {

            return d.parent
                ? d.parent.data.name
                : "";
        }


        /* Choose readable country text */

        function getCountryTextColor(d) {

            if (d.data.status === "Unchanged") {
                return "#222222";
            }

            return "#FFFFFF";
        }


        /* Test whether a country label fits */

        function countryLabelFits(d, textNode) {
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;

            const isLargeGDP = d.data.gdp >= 10000;
            const fontSize = isLargeGDP ? 13 : 11;

            const minWidth = isLargeGDP ? 55 : 50;
            const minHeight = isLargeGDP ? 22 : 20;

            const textWidth =
                textNode.getComputedTextLength();

            return (
                width >= Math.max(minWidth, textWidth + 10) &&
                height >= minHeight
            );
        }


        /* Test whether a hierarchy label fits */

        function hierarchyLabelFits(
            d,
            textNode,
            fontSize,
            horizontalPadding,
            verticalPadding
        ) {

            const width =
                d.x1 - d.x0;

            const height =
                d.y1 - d.y0;

            const textWidth =
                textNode.getComputedTextLength();

            return (
                width >=
                    textWidth + horizontalPadding &&
                height >=
                    fontSize + verticalPadding
            );
        }


        /* Add the legend inside each treemap */

        function createLegend(container) {

            d3.select(container)
                .selectAll(".treemap-legend")
                .remove();

            const legend =
                d3.select(container)
                    .append("div")
                    .attr(
                        "class",
                        "treemap-legend"
                    );

            legend.append("span")
                .attr(
                    "class",
                    "treemap-legend-title"
                )
                .text("GDP Status");

            const statuses = [
                "Increase",
                "Unchanged",
                "Decrease"
            ];

            const items =
                legend
                    .selectAll(
                        ".treemap-legend-item"
                    )
                    .data(statuses)
                    .join("div")
                    .attr(
                        "class",
                        "treemap-legend-item"
                    );

            items.append("span")
                .attr(
                    "class",
                    "treemap-legend-box"
                )
                .style(
                    "background-color",
                    function(d) {
                        return statusColor(d);
                    }
                );

            items.append("span")
                .attr(
                    "class",
                    "treemap-legend-label"
                )
                .text(function(d) {
                    return d;
                });
        }


        /* Keep the tooltip inside the viewport */

        function positionTooltip(event) {

            const tooltipNode =
                tooltip.node();

            if (!tooltipNode) {
                return;
            }

            const tooltipWidth =
                tooltipNode.offsetWidth;

            const tooltipHeight =
                tooltipNode.offsetHeight;

            let left =
                event.clientX + 14;

            let top =
                event.clientY + 14;

            if (
                left + tooltipWidth >
                window.innerWidth - 12
            ) {
                left =
                    event.clientX -
                    tooltipWidth -
                    14;
            }

            if (
                top + tooltipHeight >
                window.innerHeight - 12
            ) {
                top =
                    event.clientY -
                    tooltipHeight -
                    14;
            }

            left = Math.max(8, left);
            top = Math.max(8, top);

            tooltip
                .style("left", `${left}px`)
                .style("top", `${top}px`);
        }


        /* Use the existing shared tooltip */

        const tooltip =
            d3.select("#tooltip");


        /* Build one treemap */

        function createTreemap(
            containerSelector,
            tileMethod
        ) {

            /* Add the treemap-specific legend */

            createLegend(containerSelector);


            /* Define the SVG coordinate system */

            const width = 900;
            const height = 520;


            /* Build the D3 hierarchy */

            const root =
                d3.hierarchy(data);


            /* GDP determines rectangle area */

            root
                .sum(function(d) {
                    return d.gdp || 0;
                })
                .sort(function(a, b) {
                    return b.value - a.value;
                });


            /* Apply the selected tiling method */

            const treemap =
                d3.treemap()
                    .tile(tileMethod)
                    .size([
                        width,
                        height
                    ])
                    .paddingOuter(7)
                    .paddingInner(3)
                    .paddingTop(function(d) {

                        if (d.depth === 1) {
                            return 29;
                        }

                        if (d.depth === 2) {
                            return 21;
                        }

                        return 0;
                    })
                    .round(true);

            treemap(root);


            /* Create responsive SVG */

            const svg =
                d3.select(containerSelector)
                    .append("svg")
                    .attr(
                        "viewBox",
                        `0 0 ${width} ${height}`
                    )
                    .attr(
                        "preserveAspectRatio",
                        "xMidYMid meet"
                    );


            /* Select hierarchy levels */

            const continents =
                root.descendants()
                    .filter(function(d) {
                        return d.depth === 1;
                    });

            const areas =
                root.descendants()
                    .filter(function(d) {
                        return d.depth === 2;
                    });

            const countries =
                root.leaves();

            /* Draw subtle continent backgrounds */

            svg
                .selectAll(".continent-bg")
                .data(continents)
                .join("rect")
                .attr("class", "continent-bg")
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .attr("width", d => d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0)
                .attr("rx", 1)
                .attr("ry", 1);


            /* Draw subtle area backgrounds */

            svg
                .selectAll(".area-bg")
                .data(areas)
                .join("rect")
                .attr("class", "area-bg")
                .attr("x", d => d.x0)
                .attr("y", d => d.y0)
                .attr("width", d => d.x1 - d.x0)
                .attr("height", d => d.y1 - d.y0);

            /* Draw country cells first */

            const cells =
                svg
                    .selectAll(".treemap-cell")
                    .data(countries)
                    .join("g")
                    .attr(
                        "class",
                        "treemap-cell"
                    )
                    .attr(
                        "transform",
                        function(d) {
                            return (
                                `translate(${d.x0},${d.y0})`
                            );
                        }
                    );


            cells.append("rect")
                .attr(
                    "class",
                    "country-rect"
                )
                .attr(
                    "width",
                    function(d) {
                        return Math.max(
                            0,
                            d.x1 - d.x0
                        );
                    }
                )
                .attr(
                    "height",
                    function(d) {
                        return Math.max(
                            0,
                            d.y1 - d.y0
                        );
                    }
                )
                .attr(
                    "fill",
                    function(d) {
                        return statusColor(
                            d.data.status
                        );
                    }
                );


            /* Draw Area boundaries */

            svg
                .selectAll(".treemap-area")
                .data(areas)
                .join("rect")
                .attr(
                    "class",
                    "treemap-area"
                )
                .attr(
                    "x",
                    function(d) {
                        return d.x0;
                    }
                )
                .attr(
                    "y",
                    function(d) {
                        return d.y0;
                    }
                )
                .attr(
                    "width",
                    function(d) {
                        return d.x1 - d.x0;
                    }
                )
                .attr(
                    "height",
                    function(d) {
                        return d.y1 - d.y0;
                    }
                );


            /* Draw continent boundaries */

            svg
                .selectAll(".treemap-continent")
                .data(continents)
                .join("rect")
                .attr(
                    "class",
                    "treemap-continent"
                )
                .attr(
                    "x",
                    function(d) {
                        return d.x0;
                    }
                )
                .attr(
                    "y",
                    function(d) {
                        return d.y0;
                    }
                )
                .attr(
                    "width",
                    function(d) {
                        return d.x1 - d.x0;
                    }
                )
                .attr(
                    "height",
                    function(d) {
                        return d.y1 - d.y0;
                    }
                );


            /* Draw continent labels */

            const continentLabels =
                svg
                    .selectAll(".continent-label")
                    .data(continents)
                    .join("text")
                    .attr(
                        "class",
                        "treemap-group-label"
                    )
                    .attr(
                        "x",
                        function(d) {
                            return d.x0 + 9;
                        }
                    )
                    .attr(
                        "y",
                        function(d) {
                            return d.y0 + 20;
                        }
                    )
                    .text(function(d) {
                        return d.data.name
                            .toUpperCase();
                    });


            /* Hide continent labels that cannot fit */

            continentLabels.each(function(d) {

                const fits =
                    hierarchyLabelFits(
                        d,
                        this,
                        15,
                        20,
                        38
                    );

                if (!fits) {
                    d3.select(this).remove();
                }
            });


            /* Draw Area labels */

            const areaLabels =
                svg
                    .selectAll(".area-label")
                    .data(areas)
                    .join("text")
                    .attr(
                        "class",
                        "treemap-area-label"
                    )
                    .attr(
                        "x",
                        function(d) {
                            return d.x0 + 8;
                        }
                    )
                    .attr(
                        "y",
                        function(d) {
                            return d.y0 + 14;
                        }
                    )
                    .text(function(d) {
                        return d.data.name;
                    });


            /* Hide Area labels that cannot fit */

            areaLabels.each(function(d) {

                const fits =
                    hierarchyLabelFits(
                        d,
                        this,
                        11,
                        16,
                        28
                    );

                if (!fits) {
                    d3.select(this).remove();
                }
            });


            /* Draw country labels */

            const countryLabels =
                cells
                    .append("text")
                    .attr(
                        "class",
                        function(d) {

                            if (
                                d.data.gdp >= 10000
                            ) {
                                return (
                                    "treemap-label " +
                                    "treemap-label-large"
                                );
                            }

                            return "treemap-label";
                        }
                    )
                    .attr(
                        "x",
                        7
                    )
                    .attr(
                        "y",
                        function(d) {

                            if (
                                d.data.gdp >= 10000
                            ) {
                                return 18;
                            }

                            return 16;
                        }
                    )
                    .attr(
                        "fill",
                        function(d) {
                            return getCountryTextColor(d);
                        }
                    )
                    .text(function(d) {
                        return d.data.name;
                    });


            /* Show labels only when their actual text fits */

            countryLabels.each(function(d) {

                const fits =
                    countryLabelFits(
                        d,
                        this
                    );

                if (!fits) {
                    d3.select(this).remove();
                }
            });


            /* Add tooltip interactions */

            cells
                .on(
                    "mouseenter",
                    function(event, d) {

                        d3.select(this)
                            .select(".country-rect")
                            .style(
                                "opacity",
                                0.92
                            )
                            .style(
                                "stroke",
                                "#333333"
                            )
                            .style(
                                "stroke-width",
                                "1.5px"
                            );

                        tooltip
                            .style(
                                "opacity",
                                1
                            )
                            .html(`
                                <div class="tooltip-country">
                                    ${d.data.name}
                                </div>
                                <div>
                                    <span class="tooltip-label">
                                        Continent:
                                    </span>
                                    ${getContinent(d)}
                                </div>
                                <div>
                                    <span class="tooltip-label">
                                        Area:
                                    </span>
                                    ${getArea(d)}
                                </div>
                                <div>
                                    <span class="tooltip-label">
                                        GDP:
                                    </span>
                                    $${d.data.gdp.toLocaleString()}
                                    billion
                                </div>
                                <div>
                                    <span class="tooltip-label">
                                        GDP Status:
                                    </span>
                                    ${d.data.status}
                                </div>
                            `);

                        positionTooltip(event);
                    }
                )
                .on(
                    "mousemove",
                    function(event) {
                        positionTooltip(event);
                    }
                )
                .on(
                    "mouseleave",
                    function() {

                        d3.select(this)
                            .select(".country-rect")
                            .style(
                                "opacity",
                                null
                            )
                            .style(
                                "stroke",
                                null
                            )
                            .style(
                                "stroke-width",
                                null
                            );

                        tooltip
                            .style(
                                "opacity",
                                0
                            );
                    }
                );
        }


        /* Create the Squarify treemap */

        createTreemap(
            "#treemap-squarify",
            d3.treemapSquarify
        );


        /* Create the Binary treemap */

        createTreemap(
            "#treemap-binary",
            d3.treemapBinary
        );

    })


    /* Handle JSON loading errors */

    .catch(function(error) {

        console.error(
            "Error loading hierarchical JSON:",
            error
        );

        d3.select("#treemap-squarify")
            .append("div")
            .attr(
                "class",
                "error-message"
            )
            .text(
                "Error loading the hierarchical JSON file. " +
                "Make sure data/lab6_assignment_gdp.json " +
                "exists and that the page is being opened " +
                "through a local server or GitHub Pages."
            );
    });