// Incrementing OFFLINE_VERSION will kick off the install event and force
// previously cached resources to be updated from the network.
const OFFLINE_VERSION = 6;
const OFFLINE_CACHE_NAME = `offline-${OFFLINE_VERSION}`;
// transforms "http://localhost:55555/Portal/" and "http://localhost:55555" into "/Portal/" or "/Portal"
//  and "https://ms.portal.azure.com/" and "https://ms.portal.azure.com" into "/" or "/"
//  investigate https://msazure.visualstudio.com/One/_workitems/edit/13783715/

// Soon we should stop shipping prod code to deal with localhost details
//  investigate https://msazure.visualstudio.com/One/_workitems/edit/13835549
const SCOPE = (() => {
    const pathArray = self.location.pathname.split("/");
    return `/${pathArray[pathArray.length - 5]}`;
})();
const OFFLINE_URL = "/Offline";

const ONINSTALL_FILEREQUESTS = [
    OFFLINE_URL,
    "/Content/Css/Offline/offline.css",
    "/Content/Images/MsPortalFx/MicrosoftLogoUnsupported.png",
    "/Content/Images/MsPortalFx/UnsupportedCloud.svg",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        // Open offine cache
        caches
            .open(OFFLINE_CACHE_NAME)
            // Add resource requests to cache
            .then((cache) => {
                // Setting {cache: 'reload'} in the new request will ensure that the response
                // isn't fulfilled from the HTTP cache; i.e., it will be from the network.
                return cache.addAll(
                    ONINSTALL_FILEREQUESTS
                        // Format file names to adjust for scope
                        .map((file) => `${SCOPE}${file}`)
                        // I am not entirely sure why but sometimes SCOPE ends with "/" and sometimes not.
                        //   Investigation here #13783715 (also mentioned in line 7)
                        .map((file) => file.replace("//", "/"))
                        // Make the request to the URL defined in previous step
                        .map((file) => new Request(file, { cache: "reload" })
                    )
                );
            })
    );
});

/**
 * List of cached that we will use. The list expected to grow as we add functionality
 *  and caches to work with them.
 */
const ACTIVE_CACHES = [OFFLINE_CACHE_NAME];

self.addEventListener("activate", async (event) => {
    event.waitUntil(
        Promise.all(
            // get the list of cache names (promise)
            (await caches.keys())
                // Find the old or unexpected caches
                .filter((cacheName) => !ACTIVE_CACHES.includes(cacheName))
                // Remove the caches that we found in the filter step
                .map((cacheName) => caches.delete(cacheName))
        )
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.mode === "navigate") {
        // We ignore the SignOut path because we had a strange issue where the
        //  SW attempts to download the page SignOut instead of navigating to it
        //  https://msazure.visualstudio.com/One/_workitems/edit/12365436
        if (event.request.url.match(/SignOut/)) {
            return false;
        }

        event.respondWith(
            (async () => {
                try {
                    return await fetch(event.request);
                } catch (error) {
                    // catch is only triggered if an exception is thrown, which is likely
                    // due to a network error.
                    // If fetch() returns a valid HTTP response with a response code in
                    // the 4xx or 5xx range, the catch() will NOT be called.

                    const offlineCache = await caches.open(OFFLINE_CACHE_NAME);

                    // If the request isn't found in the cache, return OFFLINE_URL
                    return (await offlineCache.match(event.request)) ?? (await offlineCache.match(SCOPE + OFFLINE_URL));
                }
            })()
        );
    } else if (event.request.destination === "image" || event.request.destination === "style") {
        // The images in our cache would be served from cache in this codeblock.

        // TODO(saisrawi): explore the possibility to use this pattern for all style and images:
        //  https://web.dev/offline-cookbook/#cache-and-network-race
        //  and maybe update them in the cache during the request or after?
        event.respondWith(
            (async () => {
                try {
                    return await fetch(event.request);
                } catch (error) {
                    // catch is only triggered if an exception is thrown, which is likely
                    // due to a network error.
                    // If fetch() returns a valid HTTP response with a response code in
                    // the 4xx or 5xx range, the catch() will NOT be called.
                    const offlineCache = await caches.open(OFFLINE_CACHE_NAME);

                    // Try to find the resource in our cache, otherwise we just return undefined.
                    return await offlineCache.match(event.request).then((result) => {
                        if (result) {
                            // If the cache request is successful, return that
                            return result;
                        } else {
                            // If the cache request fails, try again removing "Error/"
                            return offlineCache.match(event.request.url.replace("Error/", ""));
                        }
                    });
                }
            })()
        );
    }
});
