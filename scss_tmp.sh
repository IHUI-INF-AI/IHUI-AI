SCSS=client/node_modules/.bin/sass
err=0; struct=0
while IFS= read -r f; do
  out=$("$SCSS" --load-path=client/src --load-path=client/src/styles --no-source-map --stdin < "$f" 2>&1)
  rc=$?
  if [ $rc -ne 0 ]; then
    # filter: only structural errors matter
    if echo "$out" | grep -qiE 'unclosed|expected|missing|invalid|brace|"{"|"}"|semicolon'; then
      echo "STRUCT_ERR: $f"
      echo "$out" | grep -iE 'unclosed|expected|missing|invalid|brace|"{"|"}"|semicolon' | head -3
      struct=$((struct+1))
    fi
  fi
done < <(find client/src -name '*.scss' -not -path '*/node_modules/*')
echo "DONE structural scss errors: $struct"
