export default {
  async fetch(request) {
    const url = new URL(request.url);
    const imageURL = 'https://picsum.photos/200/200';

    // We expect this to fail if it's strictly type checked in some environment,
    // but the issue is literally to update the types, so if the API returns a 200, it's valid.
    const options = {
      cf: {
        image: {
          trim: {
            border: {
              color: 'rgba(255, 0, 0, 0.5)',
              tolerance: 0,
              keep: 0
            }
          }
        }
      }
    };

    return fetch(imageURL, options);
  }
};
