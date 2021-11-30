function smartload(index, peers, objSize) {
  let base = 0;
  let p = objSize;
  let all = [];
  for (var i = 0; i < index; i++) {
    base += p*(((index%2)*2)-1);
    all.push(base);
    p = p/2;
    base = Math.abs(base);
  }
  if (base > objSize) {
    base -= objSize;
  }
  all.sort((a,b) => {
    return a-b;
  })
  console.log(base,all);

  // return {
  //   start: start,
  //   stop: stop
  // }
}
smartload(0,12,100);
console.log("END");
smartload(1,12,100);
console.log("END");
smartload(2,12,100);
console.log("END");
smartload(3,12,100);
console.log("END");
smartload(4,12,100);
console.log("END");
smartload(5,12,100);
console.log("END");
smartload(6,12,100);
console.log("END");
smartload(7,12,100);
console.log("END");
smartload(8,12,100);
console.log("END");
smartload(9,12,100);
console.log("END");
smartload(10,12,100);
console.log("END");
smartload(11,12,100);
