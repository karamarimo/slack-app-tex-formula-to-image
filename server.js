const mj = require("mathjax-node")
const axios = require("axios")
const FormData = require('form-data')
const gm = require("gm").subClass({imageMagick: true})
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')

const config = require('./config.json')

// slack app verification token (used for initial verification request)
// and bot token (used to post messages)
const {appVerifyToken, botToken} = config

const texRegex = /\$([^$]+)\$/
const slackUrl = "https://slack.com/api/files.upload"

// log out any axios request
axios.interceptors.request.use(function (config) {
  // Do something before request is sent
  console.log(config)
  return config
}, function (error) {
  // Do something with request error
  return error
})

const app = new Koa()
app.use(bodyParser())

app.use(async (ctx, next) => {
  const {url, body, method, query} = ctx.request
  console.log({body, method, query, url})
  await next()
})

app.use(async (ctx, next) => {
  const {url, body, method, query} = ctx.request

  if (body.type === "url_verification" && method === "POST") {
    console.log("verification")
    const { token, challenge } = body
    if (token === appVerifyToken && challenge) {
      ctx.body = {challenge}
    } else {
      ctx.throw(400, 'unexpected request')
    }
  } else {
    await next()
  }
})

app.use(async (ctx, next) => {
  const {request: {body: {type, event: {text, channel, user}}}, method} = ctx
  if (type === "event_callback" && method === "POST" && text) {
    console.log("event callback")
    // const text = ctx.query.tex
    const matched = texRegex.exec(text)
    console.log(text)
    if (matched) {
      const tex = matched[1]
      try {
        const buffer = await texToPngBuffer(tex)
        console.log(buffer)
        const fm = new FormData()
        fm.append("file", buffer)
        fm.append("token", botToken)
        fm.append("channels", channel)
        fm.append("filetype", "png")

        axios({
          url: slackUrl,
          method: 'POST',
          headers: {
            "Content-type": "multipart/form-data"
          },
          data: fm,
        }).then(response => {
          if (response.data.ok) {
            console.log("upload success")
          } else {
            console.error(response.data)
          }
        }).catch(err => {
          console.error(err)
        })
      } catch (err) {
        ctx.throw(200, err)
      }
    } else {
      ctx.throw(400, "tex parameter required")
    }
  } else {
    await next()
  }
})

app.use(ctx => {
  ctx.throw(400, "Page Not Found")
})

async function texToPngBuffer(tex) {
  const result = await mj.typeset({
    math: tex,
    format: "TeX",
    svg: true,
  })

  return await svgToPngBuffer(result.svg)
}

function svgToPngBuffer(svg) {
  return new Promise((resolve, reject) => {
    gm(Buffer.from(svg))
    .toBuffer('PNG', function (err, buffer) {
      if (err) return reject(err);
      resolve(buffer)
    })
  })
}

app.listen(process.env.PORT || 8080)
