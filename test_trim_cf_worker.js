// Cloudflare Workers fetch handler to test trim
export default {
  async fetch(request, env) {
    const imageUrl = "https://picsum.photos/200/300"; // Sample image

    // We can't actually run a CF worker here without wrangler, but we can look up the source
    // Let's use duckduckgo API again
  }
}
