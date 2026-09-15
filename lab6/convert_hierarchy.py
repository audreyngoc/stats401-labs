import pandas as pd
import json


# Load the flat CSV dataset
df = pd.read_csv("../data/lab6_assignment_gdp.csv")


def build_hierarchy(dataframe, levels, value_column):
    current_level = levels[0]

    groups = []

    for name, group in dataframe.groupby(current_level):
        if len(levels) > 1:
            children = build_hierarchy(
                group,
                levels[1:],
                value_column
            )

            groups.append({
                "name": name,
                "children": children
            })

        else:
            for _, row in group.iterrows():
                groups.append({
                    "name": row["country"],
                    "gdp": float(row[value_column]),
                    "status": row["gdp_status"]
                })

    return groups


hierarchy = {
    "name": "World",
    "children": build_hierarchy(
        df,
        ["continent", "area", "country"],
        "gdp_billion_usd"
    )
}


# Save hierarchical JSON
with open(
    "../data/lab6_assignment_gdp.json",
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        hierarchy,
        file,
        indent=2,
        ensure_ascii=False
    )


print("Hierarchical JSON created successfully.")