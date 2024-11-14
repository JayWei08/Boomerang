mapboxgl.accessToken = mapToken;

const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/navigation-night-v1",
    center: [103, 13.6699], // Default center (Asia region)
    zoom: 4,
});

// Add navigation controls (zoom in/out, rotate)
map.addControl(new mapboxgl.NavigationControl());

map.on("load", () => {
    // Add a GeoJSON source for the projects, enabling clustering
    map.addSource("projects", {
        type: "geojson",
        data: projects, // Use the projects passed from the server (change to relevance)
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
    });

    // Layer for clustered circles
    map.addLayer({
        id: "clusters",
        type: "circle",
        source: "projects",
        filter: ["has", "point_count"],
        paint: {
            "circle-color": [
                "step",
                ["get", "point_count"],
                "#00BCD4",
                10,
                "#2196F3",
                30,
                "#3F51B5",
            ],
            "circle-radius": [
                "step",
                ["get", "point_count"],
                15,
                10,
                20,
                30,
                25,
            ],
        },
    });

    // Text label for the number of points in each cluster
    map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "projects",
        filter: ["has", "point_count"],
        layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
        },
    });

    // Layer for individual (unclustered) project points
    map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "projects",
        filter: ["!", ["has", "point_count"]],
        paint: {
            "circle-color": "#11b4da",
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
        },
    });

    // When a cluster is clicked, zoom into the cluster
    map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ["clusters"],
        });
        const clusterId = features[0].properties.cluster_id;
        map.getSource("projects").getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
                if (err) return;

                map.easeTo({
                    center: features[0].geometry.coordinates,
                    zoom: zoom,
                });
            }
        );
    });

    // Display a popup when clicking on an unclustered project point
    map.on("click", "unclustered-point", (e) => {
        const { popUpMarkup } = e.features[0].properties; // Access `popUpMarkup`
        const coordinates = e.features[0].geometry.coordinates.slice();

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(popUpMarkup) // Use `popUpMarkup` for HTML content
            .addTo(map);
    });

    // Change cursor to pointer when hovering over clusters
    map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
    });

    // Automatically fit map bounds to show all project points
    if (projects.features.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        projects.features.forEach((feature) => {
            bounds.extend(feature.geometry.coordinates);
        });
        map.fitBounds(bounds, { padding: 50 });
    }
});
