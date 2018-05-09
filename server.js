const mj = require("mathjax-node")
const axios = require("axios")
const FormData = require('form-data')
const gm = require("gm").subClass({imageMagick: true})
const Koa = require('koa')
const bodyParser = require('koa-bodyparser')

// slack app verification token (used for initial verification request)
const appVerifToken = "cDMuus1PtRxMYAiMzgThmarg"
const botToken = process.argv0

if (!botToken) throw new Error("specify a slack token")

const texRegex = /\$([^$]+)\$/
const slackUrl = "https://slack.com/api/files.upload"

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
    const { token, challenge } = body
    if (token === appVerifToken && challenge) {
      ctx.body = {challenge}
    } else {
      ctx.throw(400, 'unexpected request')
    }
  } else {
    await next()
  }
})

app.use(async (ctx, next) => {
  if (ctx.request.body.type === "event_callback" && ctx.method === "POST" && ctx.query.tex) {
    // const { text, user, channel } = body.event
    const text = ctx.query.tex
    const matched = texRegex.exec(text)
    console.log(text)
    if (matched) {
      const tex = matched[1]
      mj.typeset({
        math: tex,
        format: "TeX", // or "inline-TeX", "MathML"
        svg: true,      // or svg:true, or html:true
      }).then(data => {
        console.log(data.svg)
        return svgToPngBuffer(data.svg)
      }).then(buffer => {
        console.log(buffer)
        ctx.body = buffer
        // const fm = new FormData()
        // fm.append("file", buffer)
        // fm.append("token", botToken)
        // fm.append("channels", channel)
        // fm.append("filetype", "png")

        // return axios({
        //   url: slackUrl,
        //   method: 'POST',
        //   headers: {
        //     "Content-type": "multipart/form-data"
        //   },
        //   data: fm,
        // }).then(response => {
        //   if (response.data.ok) {
        //     console.log("upload success")
        //   } else {
        //     console.error(response.data)
        //   }
        // }).catch(err => {
        //   console.error(err)
        // })
      }).catch(err => {
        ctx.throw(200, err)
      })
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
