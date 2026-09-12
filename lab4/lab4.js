const margin = {
    top: 130,
    right: 25,
    bottom: 70,
    left: 190
};

const container = document.querySelector("#visualization");

const containerWidth = container.clientWidth;

const width = Math.max(
    containerWidth,
    700
);

const height = 570;

const svg = d3.select("#visualization")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr(
        "viewBox",
        `0 0 ${width} ${height}`
    )
    .attr(
        "preserveAspectRatio",
        "xMidYMid meet"
    );

const chartWidth =
    width - margin.left - margin.right;

const chartHeight =
    height - margin.top - margin.bottom;

const chart = svg.append("g")
    .attr(
        "transform",
        `translate(${margin.left},${margin.top})`
    );

const tooltip = d3.select(".tooltip");

const sentimentOrder = [
    "Negative",
    "Neutral",
    "Positive"
];

const sentimentColors = {
    Negative: "#F06A5F",
    Neutral: "#E2C75F",
    Positive: "#55B3A5"
};

const companyNames = {
    "SouthwestAir": "Southwest Airlines",
    "Delta": "Delta Air Lines",
    "British_Airways": "British Airways",
    "ChipotleTweets": "Chipotle",
    "VirginTrains": "Virgin Trains",
    "AmericanAir": "American Airlines",
    "GWRHelp": "Great Western Railway",
    "AmazonHelp": "Amazon",
    "SpotifyCares": "Spotify",
    "AskPlayStation": "PlayStation",
    "TMobileHelp": "T-Mobile",
    "comcastcares": "Comcast",
    "AppleSupport": "Apple",
    "Uber_Support": "Uber"
};

d3.csv("../data/lab4_clean_tweets.csv")
    .then(data => {

        data.forEach(d => {
            d.sentiment_negative =
                +d.sentiment_negative;

            d.sentiment_neutral =
                +d.sentiment_neutral;

            d.sentiment_positive =
                +d.sentiment_positive;

            d.sentiment_score =
                +d.sentiment_score;
        });

        const companyData = d3.rollups(
            data,
            tweets => {

                const total = tweets.length;

                const negative =
                    tweets.filter(
                        d => d.sentiment === "Negative"
                    ).length;

                const neutral =
                    tweets.filter(
                        d => d.sentiment === "Neutral"
                    ).length;

                const positive =
                    tweets.filter(
                        d => d.sentiment === "Positive"
                    ).length;

                const averageScore =
                    d3.mean(
                        tweets,
                        d => d.sentiment_score
                    );

                return {
                    total: total,
                    negative: negative,
                    neutral: neutral,
                    positive: positive,
                    negativePct: negative / total,
                    neutralPct: neutral / total,
                    positivePct: positive / total,
                    averageScore: averageScore
                };
            },
            d => d.company
        )
        .map(([company, values]) => ({
            company: company,
            ...values
        }));

        companyData.sort(
            (a, b) =>
                d3.descending(
                    a.averageScore,
                    b.averageScore
                )
        );

        const stackData =
            companyData.map(d => ({
                company: d.company,
                Negative: d.negativePct,
                Neutral: d.neutralPct,
                Positive: d.positivePct,
                total: d.total,
                negative: d.negative,
                neutral: d.neutral,
                positive: d.positive,
                averageScore: d.averageScore
            }));

        const stack = d3.stack()
            .keys(sentimentOrder);

        const series = stack(stackData);

        const y = d3.scaleBand()
            .domain(
                companyData.map(
                    d => d.company
                )
            )
            .range([0, chartHeight])
            .padding(0.35);

        const x = d3.scaleLinear()
            .domain([0, 1])
            .range([0, chartWidth]);

        chart.append("g")
            .attr("class", "grid")
            .attr(
                "transform",
                `translate(0,${chartHeight})`
            )
            .call(
                d3.axisBottom(x)
                    .ticks(5)
                    .tickSize(-chartHeight)
                    .tickFormat("")
            )
            .call(
                g => {
                    g.select(".domain")
                        .remove();

                    g.selectAll("line")
                        .attr(
                            "stroke",
                            "#E5E5E5"
                        )
                        .attr(
                            "stroke-width",
                            1
                        );
                }
            )
            .lower();

        chart.append("g")
            .attr("class", "x-axis")
            .attr(
                "transform",
                `translate(0,${chartHeight})`
            )
            .call(
                d3.axisBottom(x)
                    .ticks(5)
                    .tickFormat(
                        d3.format(".0%")
                    )
            );

        chart.append("g")
            .attr("class", "y-axis")
            .call(
                d3.axisLeft(y)
                    .tickFormat(
                        company =>
                            companyNames[company] ||
                            company
                    )
            )
            .selectAll("text")
            .style(
                "font-size",
                "13px"
            );
        
                chart.append("text")
            .attr(
                "transform",
                "rotate(-90)"
            )
            .attr(
                "x",
                -chartHeight / 2
            )
            .attr(
                "y",
                -165
            )
            .attr(
                "text-anchor",
                "start"
            )
            .style(
                "font-size",
                "14px"
            )
            .style(
                "font-weight",
                "bold"
            )
            .text(
                "Company"
            );

        series.forEach(layer => {

            chart.selectAll(
                `.bar-${layer.key.toLowerCase()}`
            )
                .data(layer)
                .enter()
                .append("rect")
                .attr(
                    "class",
                    `bar-${layer.key.toLowerCase()}`
                )
                .attr(
                    "x",
                    d => x(d[0])
                )
                .attr(
                    "y",
                    d => y(d.data.company)
                )
                .attr(
                    "width",
                    d => x(d[1]) - x(d[0])
                )
                .attr(
                    "height",
                    y.bandwidth()
                )
                .attr(
                    "fill",
                    sentimentColors[layer.key]
                )
                .on(
                    "mouseover",
                    function(event, d) {

                        const company =
                            d.data.company;

                        const displayName =
                            companyNames[company] ||
                            company;

                        const sentiment =
                            layer.key;

                        let count = 0;
                        let percentage = 0;

                        if (
                            sentiment === "Negative"
                        ) {
                            count =
                                d.data.negative;

                            percentage =
                                d.data.Negative;
                        }

                        if (
                            sentiment === "Neutral"
                        ) {
                            count =
                                d.data.neutral;

                            percentage =
                                d.data.Neutral;
                        }

                        if (
                            sentiment === "Positive"
                        ) {
                            count =
                                d.data.positive;

                            percentage =
                                d.data.Positive;
                        }

                        d3.select(this)
                            .attr(
                                "opacity",
                                0.72
                            );

                        tooltip
                            .style(
                                "opacity",
                                1
                            )
                            .html(`
                                <strong>
                                    ${displayName}
                                </strong>
                                <br>
                                Sentiment:
                                ${sentiment}
                                <br>
                                Tweets:
                                ${count}
                                <br>
                                Percentage:
                                ${d3.format(".1%")(
                                    percentage
                                )}
                                <br>
                                Average sentiment score:
                                ${d3.format(".3f")(
                                    d.data.averageScore
                                )}
                            `)
                            .style(
                                "left",
                                `${event.pageX + 15}px`
                            )
                            .style(
                                "top",
                                `${event.pageY - 30}px`
                            );
                    }
                )
                .on(
                    "mousemove",
                    function(event) {

                        tooltip
                            .style(
                                "left",
                                `${event.pageX + 15}px`
                            )
                            .style(
                                "top",
                                `${event.pageY - 30}px`
                            );
                    }
                )
                .on(
                    "mouseout",
                    function() {

                        d3.select(this)
                            .attr(
                                "opacity",
                                1
                            );

                        tooltip
                            .style(
                                "opacity",
                                0
                            );
                    }
                );
        });

        chart.append("text")
            .attr(
                "class",
                "axis-label"
            )
            .attr(
                "x",
                315
            )
            .attr(
                "y",
                chartHeight + 50
            )
            .attr(
                "text-anchor",
                "start"
            )
            .style(
                "font-size",
                "14px"
            )
            .style(
                "font-weight",
                "bold"
            )
            .text(
                "Share of customer tweets"
            );


        svg.append("text")
            .attr(
                "x",
                20
            )
            .attr(
                "y",
                35
            )
            .attr(
                "text-anchor",
                "start"
            )
            .style(
                "font-size",
                "24px"
            )
            .style(
                "font-weight",
                "bold"
            )
            .text(
                "Customer Sentiment Across Companies"
            );

        svg.append("text")
            .attr(
                "x",
                24
            )
            .attr(
                "y",
                60
            )
            .attr(
                "text-anchor",
                "start"
            )
            .style(
                "font-size",
                "14px"
            )
            .text(
                "Companies ordered by average sentiment score"
            );

        const legendWidth = 240;

        const legend =
            svg.append("g")
                .attr(
                    "transform",
                    `translate(
                        25,
                        78
                    )`
                );

        sentimentOrder.forEach(
            (sentiment, i) => {

                const legendItem =
                    legend.append("g")
                        .attr(
                            "transform",
                            `translate(
                                ${i * 80},
                                0
                            )`
                        );

                legendItem.append("rect")
                    .attr(
                        "width",
                        14
                    )
                    .attr(
                        "height",
                        14
                    )
                    .attr(
                        "rx",
                        2
                    )
                    .attr(
                        "fill",
                        sentimentColors[
                            sentiment
                        ]
                    );

                legendItem.append("text")
                    .attr(
                        "x",
                        20
                    )
                    .attr(
                        "y",
                        11
                    )
                    .style(
                        "font-size",
                        "13px"
                    )
                    .text(
                        sentiment
                    );
            });

    })
    .catch(error => {

        console.error(
            "Error loading dataset:",
            error
        );

        d3.select("#visualization")
            .append("p")
            .text(
                "Unable to load the cleaned dataset."
            );
    });