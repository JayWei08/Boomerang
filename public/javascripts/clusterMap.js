mapboxgl.accessToken = mapToken; // Mapbox token injected from server-side

const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/navigation-night-v1",
    center: [103, 13.6699], // Default map center
    zoom: 4, // Default zoom level
});

// Add navigation controls (zoom in/out, rotate)
map.addControl(new mapboxgl.NavigationControl());

map.on("load", () => {
    // Add a GeoJSON source for the projects, enabling clustering
    map.addSource("projects", {
        type: "geojson",
        data: projects, // Use GeoJSON data from the server
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points
        clusterRadius: 50, // Radius of each cluster
    });

    // Add layer for clusters
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

    // Add layer for cluster labels
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

    // Add layer for unclustered points
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

    // When an unclustered point is clicked, show a popup
    map.on("click", "unclustered-point", (e) => {
        const { popUpMarkup } = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();

        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(popUpMarkup)
            .addTo(map);
    });

    // Change the cursor to a pointer when hovering over clusters
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
            if (feature.geometry && feature.geometry.coordinates) {
                bounds.extend(feature.geometry.coordinates);
            }
        });
        map.fitBounds(bounds, { padding: 50 });
    }
});
