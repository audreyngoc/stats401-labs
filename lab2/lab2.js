const width = 1150;
const height = 650;

const margin = {
    top: 140,
    right: 165,
    bottom: 100,
    left: 80
};

const tooltip = d3.select("#tooltip");

const developmentLevels = [
    "Low",
    "Medium",
    "High"
];

const regions = [
    "North",
    "South",
    "East",
    "West"
];

const regionColors = {
    North: "#0072B2",
    South: "#D55E00",
    East: "#009E73",
    West: "#CC79A7"
};


// Load and parse city data
d3.csv(
    "../data/cities_multivariate.csv",
    d => ({
        city: d.city,
        population: +d.population,
        temp_c: +d.temp_c,
        development_level: d.development_level,
        region: d.region
    })
)
.then(data => {

    const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");


    const chartWidth =
        width - margin.left - margin.right;

    const chartBottom =
        height - margin.bottom;

    const facetGap = 18;

    const facetWidth =
        (
            chartWidth -
            facetGap * (developmentLevels.length - 1)
        ) / developmentLevels.length;


    // Population scale
    const yScale = d3.scaleLinear()
        .domain([
            0,
            d3.max(data, d => d.population)
        ])
        .nice()
        .range([
            chartBottom,
            margin.top
        ]);


    // Shared y-axis
    svg.append("g")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(
            d3.axisLeft(yScale)
                .ticks(7)
        );


    // Y-axis label
    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height / 2))
        .attr("y", 22)
        .attr("text-anchor", "middle")
        .text("Population (millions)");


    // Grid lines
    svg.append("g")
        .attr("class", "grid")
        .attr(
            "transform",
            `translate(${margin.left}, 0)`
        )
        .call(
            d3.axisLeft(yScale)
                .ticks(7)
                .tickSize(-chartWidth)
                .tickFormat("")
        );

    svg.selectAll(".grid line")
        .attr("class", "grid-line");

    svg.select(".grid .domain")
        .remove();


    // Create development-level facets
    developmentLevels.forEach(
        (development, developmentIndex) => {

            const facetData = data
                .filter(
                    d =>
                        d.development_level === development
                )
                .sort(
                    (a, b) =>
                        a.population - b.population
                );


            const facetX =
                margin.left +
                developmentIndex *
                (facetWidth + facetGap);


            // Facet background
            svg.append("rect")
                .attr(
                    "class",
                    "facet-background"
                )
                .attr(
                    "x",
                    facetX
                )
                .attr(
                    "y",
                    margin.top - 28
                )
                .attr(
                    "width",
                    facetWidth
                )
                .attr(
                    "height",
                    chartBottom -
                    margin.top +
                    28
                );


            // Development-level title
            svg.append("text")
                .attr(
                    "class",
                    "facet-title"
                )
                .attr(
                    "x",
                    facetX + facetWidth / 2
                )
                .attr(
                    "y",
                    margin.top - 40
                )
                .attr(
                    "text-anchor",
                    "middle"
                )
                .text(
                    `${development} Development`
                );


            // City positions
            const cityScale = d3.scaleBand()
                .domain(
                    facetData.map(
                        d => d.city
                    )
                )
                .range([
                    facetX + 25,
                    facetX + facetWidth - 25
                ])
                .padding(0.22);


            // Population bars
            svg.selectAll(
                `.bar-${development}`
            )
            .data(facetData)
            .join("rect")
            .attr(
                "class",
                "bar"
            )
            .attr(
                "x",
                d => cityScale(d.city)
            )
            .attr(
                "y",
                d => yScale(d.population)
            )
            .attr(
                "width",
                cityScale.bandwidth()
            )
            .attr(
                "height",
                d =>
                    chartBottom -
                    yScale(d.population)
            )
            .attr(
                "fill",
                d => regionColors[d.region]
            )


            // Interactive tooltip
            .on(
                "mouseover",
                function(event, d) {

                    d3.select(this)
                        .attr("opacity", 1)
                        .attr("stroke", "#222")
                        .attr("stroke-width", 2);


                    tooltip
                        .style("opacity", 1)
                        .html(`
                            <strong>${d.city}</strong><br>
                            Population: ${d.population.toFixed(1)} million<br>
                            Development: ${d.development_level}<br>
                            Region: ${d.region}<br>
                            Temperature: ${d.temp_c.toFixed(1)}°C
                        `);
                }
            )


            .on(
                "mousemove",
                function(event) {

                    tooltip
                        .style(
                            "left",
                            `${event.pageX + 12}px`
                        )
                        .style(
                            "top",
                            `${event.pageY + 12}px`
                        );
                }
            )


            .on(
                "mouseout",
                function() {

                    d3.select(this)
                        .attr("opacity", 0.88)
                        .attr("stroke", "none");


                    tooltip
                        .style(
                            "opacity",
                            0
                        );
                }
            );


            // Population labels
            svg.selectAll(
                `.population-${development}`
            )
            .data(facetData)
            .join("text")
            .attr(
                "class",
                "population-label"
            )
            .attr(
                "x",
                d =>
                    cityScale(d.city) +
                    cityScale.bandwidth() / 2
            )
            .attr(
                "y",
                d => yScale(d.population) - 8
            )
            .attr(
                "text-anchor",
                "middle"
            )
            .text(
                d =>
                    `${d.population.toFixed(1)}M`
            );


            // City labels
            svg.selectAll(
                `.city-${development}`
            )
            .data(facetData)
            .join("text")
            .attr(
                "class",
                "city-label"
            )
            .attr(
                "x",
                d =>
                    cityScale(d.city) +
                    cityScale.bandwidth() / 2
            )
            .attr(
                "y",
                chartBottom + 23
            )
            .attr(
                "text-anchor",
                "middle"
            )
            .text(
                d => d.city
            );
        }
    );


    // X-axis label
    svg.append("text")
        .attr(
            "class",
            "axis-label"
        )
        .attr(
            "x",
            margin.left +
            chartWidth / 2
        )
        .attr(
            "y",
            height - 28
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text("City");


    // Region legend
    const legendX =
        width - margin.right + 18;

    const legendY =
        margin.top + 15;


    svg.append("text")
        .attr(
            "class",
            "legend-title"
        )
        .attr(
            "x",
            legendX
        )
        .attr(
            "y",
            legendY
        )
        .text("Region");


    regions.forEach(
        (region, index) => {

            const y =
                legendY +
                32 +
                index * 30;


            svg.append("rect")
                .attr(
                    "x",
                    legendX
                )
                .attr(
                    "y",
                    y - 12
                )
                .attr(
                    "width",
                    16
                )
                .attr(
                    "height",
                    16
                )
                .attr(
                    "fill",
                    regionColors[region]
                );


            svg.append("text")
                .attr(
                    "class",
                    "legend-label"
                )
                .attr(
                    "x",
                    legendX + 26
                )
                .attr(
                    "y",
                    y + 1
                )
                .text(region);
        }
    );


    // Chart title
    svg.append("text")
        .attr(
            "class",
            "chart-title"
        )
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            32
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "City Population by Development Level Across Regions"
        );


    // Chart subtitle
    svg.append("text")
        .attr(
            "class",
            "chart-subtitle"
        )
        .attr(
            "x",
            width / 2
        )
        .attr(
            "y",
            60
        )
        .attr(
            "text-anchor",
            "middle"
        )
        .text(
            "Bar height represents population; color represents region; hover for temperature"
        );

});