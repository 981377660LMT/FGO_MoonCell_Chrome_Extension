const insertEle = () => {
  const th = document.createElement('th')
  th.innerHTML = '下载人物对话文本'
  th.style.padding = '20px'
  document.querySelector('.column-header').appendChild(th)

  Array.from(document.querySelectorAll('.column-header ~ tr')).forEach(tr => {
    const btn = document.createElement('button')
    btn.innerHTML = '下载'
    btn.style.cursor = 'pointer'
    btn.addEventListener('click', function () {
      // 需要中文的从者名拼接URL
      const servantURL = this.parentNode.parentNode.children[2].firstChild.getAttribute('href')
      console.log(servantURL)
      chrome.runtime.sendMessage(servantURL)
    })

    const td = document.createElement('td')
    td.appendChild(btn)

    tr.appendChild(td)
  })
}

const observeEle = () => {
  const targetNode = document.querySelector('#list')
  const config = { attributes: true, childList: true, subtree: true }
  const callback = function (mutationsList) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        observer.disconnect()
        insertEle()
        observeEle()
      }
    }
  }
  const observer = new MutationObserver(callback)

  observer.observe(targetNode, config)
}

window.onload = () => {
  insertEle()
  observeEle()
}
