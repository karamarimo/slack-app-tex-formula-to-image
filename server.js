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
const svgXmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

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
    ctx.status = 200
    ctx.res.end()
    console.log("event callback")
    // const text = ctx.query.tex
    const matched = texRegex.exec(text)
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

        await axios({
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
          console.error("request to slack failed")
          console.error(err)
        })
      } catch (err) {
        console.error("failed to convert")
        console.error(err)
      }
    } else {
      console.log("no formula found")
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
  const svgString = svgXmlDeclaration + result.svg
  return await svgToPngBuffer(svgString)
}

function svgToPngBuffer(svg) {
  return gmToBuffer(gm(Buffer.from(svg), 'svg.svg').setFormat("png"))
}

function gmToBuffer (data) {
  return new Promise((resolve, reject) => {
    data.stream((err, stdout, stderr) => {
      if (err) { return reject(err) }
      const chunks = []
      stdout.on('data', (chunk) => { chunks.push(chunk) })
      // these are 'once' because they can and do fire multiple times for multiple errors,
      // but this is a promise so you'll have to deal with them one at a time
      stdout.once('end', () => resolve(Buffer.concat(chunks)))
      stderr.once('data', (data) => reject(String(data)))
    })
  })
}

app.listen(process.env.PORT || 8080)
