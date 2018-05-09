const axios = require("axios")

axios.interceptors.request.use(function (config) {
  // Do something before request is sent
  console.log(config)
  return config
}, function (error) {
  // Do something with request error
  return Promise.reject(error);
});

axios.get('https://jsonplaceholder.typicode.com/posts/1').then(response => {
  console.log(response.data)
})
