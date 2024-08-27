#!/bin/bash

DIR=~/Sync/budget/ledger
FILE=ynab.ledger
FILE_BEANCOUNT=ynab.beancount

GIT_SSH=true
GIT_SSH_KEY=~/.ssh/github
GIT_PUSH=true

retrieveYNAB() {

    datetime=$(date +"%Y-%m-%d %T")

    ynab-to-ledger --budget > $FILE
    if [ $? -ne 0 ]; then
        >&2 echo "Failed to run 'ynab-to-ledger' for ledger"
    fi
    git add $FILE
    git commit -m "YNAB to ledger compilation at $datetime"

    ynab-to-ledger --beancount > $FILE_BEANCOUNT
    if [ $? -ne 0 ]; then
        >&2 echo "Failed to run 'ynab-to-ledger' for beancount"
    fi
    git add $FILE_BEANCOUNT
    git commit -m "YNAB to beancount compilation at $datetime"

    if [ $GIT_PUSH = true ]; then

        # Enable ssh key if available
        if [ $GIT_SSH = true ]; then
            eval $(ssh-agent -s)
            ssh-add $GIT_SSH_KEY
        fi
        
        git push
    fi

}

pushd $DIR

[ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Initializing git repo: $DIR"
    git init
    retrieveYNAB
elif git diff-index --quiet HEAD --; then
    retrieveYNAB
else
    >&2 echo "$DIR is dirty, there are uncommited changes.  Exiting..."
    popd
    exit 1
fi

popd
exit 0
