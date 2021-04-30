const domParser = new DOMParser()

const flat = arr => {
  if (Object.prototype.toString.call(arr) != '[object Array]') {
    throw Error('flat的参数需要是一个数组')
  }

  let res = arr.reduce((prev, cur) => {
    return prev.concat(Array.isArray(cur) ? flat(cur) : cur)
  }, [])

  return res
}

/**
 * 自定义去重
 * @param {Array<{中文文本:string,日文文本:string,语音地址:string}>} textArray
 */
const removeDuplicateItem = textArray => {
  // console.log(textArray)
  const map = new Map()
  const res = textArray.filter(item => {
    if (map.has(item['中文文本']) && map.get(item['中文文本']) === item['日文文本']) {
      return false
    } else {
      map.set(item['中文文本'], item['日文文本'])
      return true
    }
  })

  return res
}

/**
 * 创建.xlsx文件
 * @param {string} fileName
 * @param {Array<{中文文本:string,日文文本:string,语音地址:string}>} fileData
 */
const createXLS = (fileName, fileData) => {
  const workBook = XLSX.utils.book_new()
  const workSheet = XLSX.utils.json_to_sheet(fileData)
  XLSX.utils.book_append_sheet(workBook, workSheet, 'Results')
  XLSX.writeFile(workBook, `${fileName}.xlsx`, { type: 'file', compression: true })
}

/**
 * 处理每一项的格式
 * @param {Array<string|null>} CH
 * @param {Array<string|null>} JP
 * @param {Array<string|null>} voiceLink
 * @returns
 */
const createItem = (CH, JP, voiceLink) => {
  const startArray = Array(Math.max(CH.length, JP.length, voiceLink.length)).fill('')
  const res = startArray.map((value, index) => ({
    中文文本: CH[index] || '',
    日文文本: JP[index] || '',
    语音地址: voiceLink[index] || '',
  }))

  return res
}

/**
 * 解析从者主页面语音
 * @param {Document} dom
 * @returns
 */
const parseMainData = dom =>
  // 注意为空则不执行
  Array.from(dom.body.querySelectorAll('tbody')).map(tbody => {
    const CH = Array.from(tbody.querySelectorAll('p:not([lang="ja"])')).map(p => p.innerText)
    const JP = Array.from(tbody.querySelectorAll('p[lang="ja"]')).map(p => p.innerText)
    const voiceLink = Array.from(tbody.querySelectorAll('.MiniAudioPlayer a[download]')).map(
      p => 'https:' + p.getAttribute('href')
    )
    // console.log(voiceLink)
    return [
      { 中文文本: '一般语音文本', 日文文本: '', 语音地址: '' },
      ...createItem(CH, JP, voiceLink),
    ]
  })

/**
 * 解析从者情人节语音
 * @param {Document} dom
 * @returns
 */
const parseValentineData = dom =>
  Array.from(dom.body.querySelectorAll('tbody')).map(tbody => {
    const CH = Array.from(tbody.querySelectorAll('.MiniAudioPlayer')).map(
      span => span.parentElement.nextElementSibling.querySelector('.voicescript-text-cn').innerText
    )
    const JP = Array.from(tbody.querySelectorAll('.MiniAudioPlayer')).map(
      span => span.parentElement.nextElementSibling.querySelector('.voicescript-text-jp').innerText
    )
    const voiceLink = Array.from(tbody.querySelectorAll('.MiniAudioPlayer a[download]')).map(
      p => 'https://fgo.wiki' + p.getAttribute('href')
    )
    // console.log(CH)
    return [
      { 中文文本: '情人节语音文本', 日文文本: '', 语音地址: '' },
      ...createItem(CH, JP, voiceLink),
    ]
  })

/**
 * 获取语音数据
 * @param {string} url
 * @param {(dom:Document)=>Array<Array<{中文文本:string,日文文本:string,语音地址:string}>>} parser
 * @returns {Promise<Array<{中文文本:string,日文文本:string,语音地址:string}>>}
 */
const getVoiceData = (url, parser) =>
  new Promise((resolve, reject) => {
    axios
      .get(url)
      .then(res => {
        const mainVoiceDataDom = domParser.parseFromString(res.data, 'text/html')
        const allText = removeDuplicateItem(flat(parser(mainVoiceDataDom)))
        // console.log(allText)
        resolve(
          allText.length > 0
            ? allText
            : [{ 中文文本: '暂无语音', 日文文本: '暂无语音', 语音地址: '暂无语音' }]
        )
      })
      .catch(err => {
        console.error(err)
        reject([{ 中文文本: '', 日文文本: '', 语音地址: '' }])
      })
  })

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // console.error(request)
    const fileName = request.split('/').reverse()[0]
    const fileData = []
    // console.log(fileName)
    const mainVoiceDataURL = 'https://fgo.wiki' + encodeURI(request) + encodeURI('/语音')
    const valentineVoiceDataURL =
      'https://fgo.wiki' + encodeURI(request) + encodeURI('/情人节剧情语音')
    const promiseArray = [
      getVoiceData(mainVoiceDataURL, parseMainData),
      getVoiceData(valentineVoiceDataURL, parseValentineData),
    ]

    // 整合语音文本，生成文档
    Promise.all(promiseArray)
      .then(resArray => {
        resArray.forEach(res => {
          fileData.push(...res, { 中文文本: '', 日文文本: '', 语音地址: '' })
        })
        createXLS(fileName, fileData)
      })
      .catch(err => console.error(err))
  } catch (error) {
    console.error(error)
  }
})
