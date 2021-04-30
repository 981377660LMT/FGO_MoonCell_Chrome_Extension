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
 * @param {Array<{中文文本:String,日文文本:String}>} textArray
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
 * @param {Array<{中文文本:String,日文文本:String}>} fileData
 */
const createXLS = (fileName, fileData) => {
  const workBook = XLSX.utils.book_new()
  const workSheet = XLSX.utils.json_to_sheet(fileData)
  XLSX.utils.book_append_sheet(workBook, workSheet, 'Results')
  XLSX.writeFile(workBook, `${fileName}.xlsx`, { type: 'file', compression: true })
}

/**
 * 处理每一项的格式
 * @param {Array<string|null>} CHArray
 * @param {Array<string|null>} JPArray
 * @returns
 */
const createItem = (CHArray, JPArray) => {
  const startArray = Array(Math.max(CHArray.length, JPArray.length)).fill('')
  const res = startArray.map((value, index) => ({
    中文文本: CHArray[index] || '',
    日文文本: JPArray[index] || '',
  }))

  return res
}

/**
 * 解析从者主页面语音
 * @param {Document} dom
 * @returns
 */
const parseMainData = dom =>
  Array.from(dom.body.querySelectorAll('tbody')).map(tbody => {
    const CH = Array.from(tbody.querySelectorAll('p:not([lang="ja"])')).map(p => p.innerText)
    const JP = Array.from(tbody.querySelectorAll('p[lang="ja"]')).map(p => p.innerText)
    return [{ 中文文本: '一般语音文本', 日文文本: '' }, ...createItem(CH, JP)]
  })

/**
 * 解析从者情人节语音
 * @param {Document} dom
 * @returns
 */
const parseValentineData = dom =>
  Array.from(dom.body.querySelectorAll('tbody')).map(tbody => {
    const CH = Array.from(tbody.querySelectorAll('.voicescript-text-cn')).map(p => p.innerText)
    const JP = Array.from(tbody.querySelectorAll('.voicescript-text-jp')).map(p => p.innerText)
    return [{ 中文文本: '情人节语音文本', 日文文本: '' }, ...createItem(CH, JP)]
  })

/**
 * 获取语音数据
 * @param {string} url
 * @param {(dom:Document)=>Array<Array<{中文文本:String,日文文本:String}>>} parser
 * @returns {Promise<Array<{中文文本:String,日文文本:String}>>}
 */
const getVoiceData = (url, parser) =>
  new Promise((resolve, reject) => {
    axios
      .get(url)
      .then(res => {
        const mainVoiceDataDom = domParser.parseFromString(res.data, 'text/html')
        const allText = removeDuplicateItem(flat(parser(mainVoiceDataDom)))
        // console.log(allText)
        resolve(allText.length > 0 ? allText : [{ 中文文本: '暂无语音', 日文文本: '暂无语音' }])
      })
      .catch(err => {
        console.error(err)
        reject([{ 中文文本: '', 日文文本: '' }])
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
          fileData.push(...res, { 中文文本: '', 日文文本: '' })
        })
        createXLS(fileName, fileData)
      })
      .catch(err => console.error(err))
  } catch (error) {
    console.error(error)
  }
})
