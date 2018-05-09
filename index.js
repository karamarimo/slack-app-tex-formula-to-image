const mj = require("mathjax-node-svg2png")
const axios = require("axios")
const FormData = require('form-data')

// slack app verification token (used for initial verification request)
const appVerifToken = "cDMuus1PtRxMYAiMzgThmarg"
const botToken = "xoxb-341040671266-vAAnzrkAg1FSSGzwA3agm8zd"

const texRegex = /\$([^$]+)\$/
const slackUrl = "https://slack.com/api/files.upload"

console.log("cold start")

exports.tex2img = (req, res) => {
  const {body, method, query} = req
  console.log({body, method, query})

  if (body.type === "url_verification" && method === "POST") {
    const { token, challenge } = body
    if (token === appVerifToken && challenge) {
      res.json({challenge})
    } else {
      res.sendStatus(400)
    }
  } else if (body.type === "event_callback" && method === "POST") {
    const { text, user, channel } = body.event

    const matched = texRegex.exec(text)
    console.log(text)
    if (matched) {
      const tex = matched[1]
      mj.typeset({
        math: tex,
        format: "TeX", // or "inline-TeX", "MathML"
        png: true,      // or svg:true, or html:true
      }).then(data => {
        const img = data.png
        const fm = new FormData()
        fm.append("file", Buffer.from(img.slice(21), 'base64'))
        fm.append("token", botToken)
        fm.append("channels", channel)
        fm.append("filetype", "png")
        axios({
          url: slackUrl,
          method: 'POST',
          headers: {
            "Content-type": "multipart/form-data"
          },
          data: fm
        }).then(response => {
          if (response.data.ok) {
            console.log("upload success")
          } else {
            console.error(response.data)
          }
          res.sendStatus(200)
        }).catch(err => {
          console.error(err)
          res.sendStatus(200)
        })
      }).catch(err => {
        console.error("conversion error")
        console.error(err)
        res.sendStatus(200)
      })
    } else {
      console.error("tex formula not included")
      res.sendStatus(200)
    }
  } else {
    res.sendStatus(400)
  }
}
